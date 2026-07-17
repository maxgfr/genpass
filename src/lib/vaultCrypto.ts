// The cryptographic boundary. Web Crypto only — no libraries.
// Master password → PBKDF2-SHA256 → 256-bit AES-GCM key (non-extractable).

import { randomBytes } from './random'
import { fromBase64, toBase64, type EncryptedVaultFile, type VaultPayload } from './vaultFormat'

// Above OWASP's 600k floor for PBKDF2-HMAC-SHA256; vault files and share
// links both store their iteration count, so older artifacts stay readable.
export const DEFAULT_ITERATIONS = 1_000_000
export const SALT_BYTES = 16
export const IV_BYTES = 12

/** Wrong password and tampered data are cryptographically indistinguishable
 *  under GCM — the UI copy must present both possibilities. */
export class VaultDecryptError extends Error {
  constructor() {
    super('Wrong master password, or the vault data is corrupted.')
    this.name = 'VaultDecryptError'
  }
}

export function generateSalt(): Uint8Array {
  return randomBytes(SALT_BYTES)
}

export function generateIv(): Uint8Array {
  return randomBytes(IV_BYTES)
}

export async function deriveKey(
  masterPassword: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptJson(
  key: CryptoKey,
  data: unknown,
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  // Fresh IV on every call — IV reuse under GCM is catastrophic, so the IV is
  // generated here and is deliberately not a parameter.
  const iv = generateIv()
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  )
  return { iv, ciphertext: new Uint8Array(ciphertext) }
}

export async function decryptJson<T>(key: CryptoKey, iv: Uint8Array, ciphertext: Uint8Array): Promise<T> {
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    )
  } catch {
    throw new VaultDecryptError()
  }
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}

/** Encrypt a payload under a NEW salt derived from the password (create vault,
 *  change master password). */
export async function sealVault(
  payload: VaultPayload,
  masterPassword: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<EncryptedVaultFile> {
  const salt = generateSalt()
  const key = await deriveKey(masterPassword, salt, iterations)
  return sealWithKey(key, { salt: toBase64(salt), iterations }, payload)
}

/** Re-encrypt a payload with an already-derived key (entry mutations) —
 *  keeps salt and iterations, fresh IV. */
export async function sealWithKey(
  key: CryptoKey,
  params: Pick<EncryptedVaultFile, 'salt' | 'iterations'>,
  payload: VaultPayload,
): Promise<EncryptedVaultFile> {
  const { iv, ciphertext } = await encryptJson(key, payload)
  return {
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: params.iterations,
    salt: params.salt,
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  }
}

/** Derive the key from the file's own KDF params and decrypt. */
export async function openVault(
  file: EncryptedVaultFile,
  masterPassword: string,
): Promise<{ key: CryptoKey; payload: VaultPayload }> {
  const key = await deriveKey(masterPassword, fromBase64(file.salt), file.iterations)
  const payload = await decryptJson<VaultPayload>(key, fromBase64(file.iv), fromBase64(file.ciphertext))
  return { key, payload }
}
