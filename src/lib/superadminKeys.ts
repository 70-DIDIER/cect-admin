/**
 * SuperAdmin signing keys remain in the browser.
 * Version 2 encrypts PKCS#8 at rest with PBKDF2-SHA256 and AES-256-GCM.
 * Version 1 is accepted strictly for migration of pre-existing demo keys.
 */
export interface LegacySuperadminKeyFile {
  format: 'CECT-SUPERADMIN-KEY'
  version: 1
  key_id: string
  private_key_pkcs8: string
  created_at: string
}
export interface EncryptedSuperadminKeyFile {
  format: 'CECT-SUPERADMIN-KEY'
  version: 2
  key_id: string
  created_at: string
  kdf: 'PBKDF2-SHA256'
  cipher: 'AES-256-GCM'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}
export type SuperadminKeyFile = LegacySuperadminKeyFile | EncryptedSuperadminKeyFile

const ITERATIONS = 600_000
const KEY_ID_RE = /^[a-f0-9-]{36}$/i
function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}
function fromBase64(value: string): ArrayBuffer {
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
  return bytes.buffer
}
function validatePassphrase(passphrase: string) {
  if (passphrase.length < 14) {
    throw new Error('La phrase secrète doit contenir au moins 14 caractères.')
  }
}
async function encryptionKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const imported = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, iterations },
    imported,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}
export async function createKeyMaterial() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']
  ) as CryptoKeyPair
  const publicKey = await crypto.subtle.exportKey('spki', pair.publicKey)
  const privateKey = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  const pem = toBase64(publicKey).match(/.{1,64}/g)?.join('\n')
  if (!pem) throw new Error('Impossible de générer la clé publique.')
  return { public_key_pem: `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----\n`, private_key_pkcs8: toBase64(privateKey) }
}
export async function createKeyFile(keyId: string, privateKey: string, passphrase: string): Promise<EncryptedSuperadminKeyFile> {
  if (!KEY_ID_RE.test(keyId)) throw new Error('Identifiant cryptographique invalide.')
  validatePassphrase(passphrase)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await encryptionKey(passphrase, salt, ITERATIONS)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(keyId) },
    key, fromBase64(privateKey)
  )
  return { format: 'CECT-SUPERADMIN-KEY', version: 2, key_id: keyId,
    created_at: new Date().toISOString(), kdf: 'PBKDF2-SHA256', cipher: 'AES-256-GCM',
    iterations: ITERATIONS, salt: toBase64(salt.buffer), iv: toBase64(iv.buffer),
    ciphertext: toBase64(ciphertext) }
}
export function parseKeyFile(text: string): SuperadminKeyFile {
  let parsed: unknown
  try { parsed = JSON.parse(text) }
  catch { throw new Error('Choisissez un fichier .cectkey, et non le certificat .crt ou .p12.') }
  if (!parsed || typeof parsed !== 'object') throw new Error('Le fichier CECT est invalide.')
  const key = parsed as Partial<SuperadminKeyFile>
  if (key.format !== 'CECT-SUPERADMIN-KEY' || typeof key.key_id !== 'string' || !KEY_ID_RE.test(key.key_id)) {
    throw new Error('Le fichier CECT est invalide.')
  }
  if (key.version === 1) {
    const legacy = key as LegacySuperadminKeyFile
    if (typeof legacy.private_key_pkcs8 !== 'string' || legacy.private_key_pkcs8.length > 10000) throw new Error('Clé historique invalide.')
    return legacy
  }
  if (key.version === 2) {
    const file = key as EncryptedSuperadminKeyFile
    if (file.kdf !== 'PBKDF2-SHA256' || file.cipher !== 'AES-256-GCM' ||
        !Number.isInteger(file.iterations) || file.iterations < ITERATIONS || file.iterations > 2_000_000 ||
        ![file.salt, file.iv, file.ciphertext].every((v) => typeof v === 'string' && v.length > 0 && v.length < 12000)) {
      throw new Error('Clé chiffrée invalide ou format non pris en charge.')
    }
    return file
  }
  throw new Error('Version de fichier CECT non prise en charge.')
}
export async function privateKeyFromKeyFile(file: SuperadminKeyFile, passphrase: string): Promise<ArrayBuffer> {
  if (file.version === 1) return fromBase64(file.private_key_pkcs8)
  if (!passphrase) throw new Error('Saisissez la phrase secrète de votre fichier .cectkey.')
  try {
    const salt = new Uint8Array(fromBase64(file.salt))
    const iv = new Uint8Array(fromBase64(file.iv))
    if (salt.byteLength !== 16 || iv.byteLength !== 12) throw new Error('Invalid key salt or IV')
    const key = await encryptionKey(passphrase, salt, file.iterations)
    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(file.key_id) },
      key, fromBase64(file.ciphertext)
    )
  } catch {
    throw new Error('Impossible de déchiffrer : phrase secrète incorrecte ou fichier altéré.')
  }
}
/** Derive public key locally; never transmit the private key to the server. */
export async function publicPemFromKeyFile(file: SuperadminKeyFile, passphrase = ''): Promise<string> {
  const privateBytes = await privateKeyFromKeyFile(file, passphrase)
  const privateKey = await crypto.subtle.importKey('pkcs8', privateBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['sign'])
  const jwk = await crypto.subtle.exportKey('jwk', privateKey)
  if (!jwk.n || !jwk.e) throw new Error('La clé CECT ne contient pas une clé RSA valide.')
  const publicKey = await crypto.subtle.importKey('jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true, key_ops: ['verify'] },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify'])
  const spki = toBase64(await crypto.subtle.exportKey('spki', publicKey))
  return `-----BEGIN PUBLIC KEY-----\n${spki.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----\n`
}
export async function signChallenge(file: SuperadminKeyFile, challengeId: string, nonce: string, passphrase = ''): Promise<string> {
  const privateKey = await crypto.subtle.importKey('pkcs8', await privateKeyFromKeyFile(file, passphrase),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const bytes = new TextEncoder().encode(`CECT_SUPERADMIN_V1\n${challengeId}\n${nonce}`)
  return toBase64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, bytes))
}
export function downloadKeyFile(key: SuperadminKeyFile) {
  const blob = new Blob([JSON.stringify(key, null, 2)], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `CECT-superadmin-${key.key_id}.cectkey`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
