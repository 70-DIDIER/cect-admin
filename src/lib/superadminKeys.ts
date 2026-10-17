/**
 * Client-held RSA key material. The PKCS#8 private key NEVER leaves the browser.
 * Treat .cectkey as a sensitive private key: store it in encrypted storage.
 */
export interface SuperadminKeyFile {
  format: 'CECT-SUPERADMIN-KEY'
  version: 1
  key_id: string
  private_key_pkcs8: string
  created_at: string
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function fromBase64(value: string): ArrayBuffer {
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
  return bytes.buffer
}

export async function createKeyMaterial() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  ) as CryptoKeyPair
  const publicKey = await crypto.subtle.exportKey('spki', pair.publicKey)
  const privateKey = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  const pem = toBase64(publicKey).match(/.{1,64}/g)?.join('\n')
  if (!pem) throw new Error('Impossible de générer la clé publique.')
  return { public_key_pem: `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----\n`, private_key_pkcs8: toBase64(privateKey) }
}

/** Derive the public half locally; never send the user's private key to the API. */
export async function publicPemFromKeyFile(file: SuperadminKeyFile): Promise<string> {
  const key = await crypto.subtle.importKey('pkcs8', fromBase64(file.private_key_pkcs8),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['sign'])
  const jwk = await crypto.subtle.exportKey('jwk', key)
  if (!jwk.n || !jwk.e) throw new Error('La clé CECT ne contient pas une clé RSA valide.')
  const publicKey = await crypto.subtle.importKey('jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true, key_ops: ['verify'] },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify'])
  const spki = toBase64(await crypto.subtle.exportKey('spki', publicKey))
  return `-----BEGIN PUBLIC KEY-----\n${spki.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----\n`
}

export function createKeyFile(keyId: string, privateKey: string): SuperadminKeyFile {
  return { format: 'CECT-SUPERADMIN-KEY', version: 1, key_id: keyId, private_key_pkcs8: privateKey, created_at: new Date().toISOString() }
}

export function parseKeyFile(text: string): SuperadminKeyFile {
  const parsed: unknown = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object') throw new Error('Fichier de clé invalide.')
  const key = parsed as Partial<SuperadminKeyFile>
  if (key.format !== 'CECT-SUPERADMIN-KEY' || key.version !== 1 ||
      typeof key.key_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(key.key_id) ||
      typeof key.private_key_pkcs8 !== 'string' || key.private_key_pkcs8.length > 10000) {
    throw new Error('Ce fichier n’est pas une clé CECT valide.')
  }
  return key as SuperadminKeyFile
}

export async function signChallenge(key: SuperadminKeyFile, challengeId: string, nonce: string): Promise<string> {
  const privateKey = await crypto.subtle.importKey('pkcs8', fromBase64(key.private_key_pkcs8),
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
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
