/* Cryptographic smoke checks: legacy migration, AES-GCM secrecy, integrity and WebCrypto proof. */
'use strict'
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const { randomUUID, webcrypto } = require('node:crypto')
const ts = require('typescript')
const Module = require('node:module')

globalThis.crypto = webcrypto
const modulePath = path.join(__dirname, '../src/lib/superadminKeys.ts')
const js = ts.transpileModule(readFileSync(modulePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const testModule = new Module(modulePath, module)
testModule.filename = modulePath
testModule.paths = module.paths
testModule._compile(js, modulePath)
const api = testModule.exports

async function main() {
  const { public_key_pem, private_key_pkcs8 } = await api.createKeyMaterial()
  const id = randomUUID()
  const phrase = 'CECT demo passphrase very long 2026'
  const key = await api.createKeyFile(id, private_key_pkcs8, phrase)
  assert.equal(key.version, 2)
  assert.equal(key.cipher, 'AES-256-GCM')
  assert.equal(key.iterations >= 600000, true)
  assert.equal(JSON.stringify(key).includes(private_key_pkcs8), false, 'private PKCS8 must not be stored in plaintext')
  const parsed = api.parseKeyFile(JSON.stringify(key))
  assert.equal(parsed.key_id, id)
  assert.equal(await api.publicPemFromKeyFile(parsed, phrase), public_key_pem)
  await assert.rejects(api.privateKeyFromKeyFile(parsed, 'incorrect passphrase'), /phrase secrète incorrecte/)
  const modified = { ...parsed, ciphertext: parsed.ciphertext.slice(0, -4) + 'AAAA' }
  await assert.rejects(api.privateKeyFromKeyFile(modified, phrase), /phrase secrète incorrecte/)
  const challengeId = randomUUID()
  const nonce = randomUUID()
  const signature = await api.signChallenge(parsed, challengeId, nonce, phrase)
  const pub = await crypto.subtle.importKey('spki', Buffer.from(public_key_pem.replace(/-----(BEGIN|END) PUBLIC KEY-----|\s/g,''), 'base64'),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pub, Buffer.from(signature, 'base64'), new TextEncoder().encode(`CECT_SUPERADMIN_V1\n${challengeId}\n${nonce}`))
  assert.equal(ok, true, 'same cryptographic proof server verifies')

  // Old demo key can be opened and re-encrypted with the SAME key_id/public key.
  const legacy = api.parseKeyFile(JSON.stringify({ format:'CECT-SUPERADMIN-KEY',version:1,key_id:id,private_key_pkcs8,created_at:new Date().toISOString() }))
  assert.equal(await api.publicPemFromKeyFile(legacy), public_key_pem)
  const migrated = await api.createKeyFile(legacy.key_id, legacy.private_key_pkcs8, phrase)
  assert.equal(await api.publicPemFromKeyFile(migrated, phrase), public_key_pem)
  await assert.rejects(api.createKeyFile(id,private_key_pkcs8,'short'),/14 caractères/)
  console.log('PASS: legacy migration, confidentiality, wrong-passphrase rejection, tamper rejection and RSA proof')
}
main().catch((err)=>{ console.error(err); process.exitCode = 1 })
