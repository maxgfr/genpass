// Client-side secret sharing. There is no server, so the encrypted secret
// travels INSIDE the link's fragment (#s=…) — fragments are never sent to the
// web server. Two modes:
//   'key'  — a random 256-bit key is embedded in the fragment: the link alone
//            opens the secret.
//   'pass' — the key is derived from a passphrase (PBKDF2) communicated over
//            a separate channel: the link alone is useless.
// Honest limits (stated in the UI): expiry is soft (checked by the opening
// device; an already-shared link cannot be destroyed), there is no one-time
// view, and links persist in browser history.

import { randomBytes } from './random'
import { DEFAULT_ITERATIONS, decryptJson, deriveKey, encryptJson, generateSalt } from './vaultCrypto'
import { fromBase64, toBase64 } from './vaultFormat'

export interface SharePayload {
  secret: string
  label?: string
  /** Expiry, epoch ms. Travels inside the ciphertext, so it is GCM-
   *  authenticated — it cannot be stripped or altered without breaking
   *  decryption. Absent = never expires. */
  exp?: number
}

interface ShareEnvelopeCommon {
  v: 1
  iv: string
  ct: string
}

export type ShareEnvelope =
  | (ShareEnvelopeCommon & {
      m: 'key'
      /** Raw AES key, base64url. */
      k: string
    })
  | (ShareEnvelopeCommon & {
      m: 'pass'
      /** PBKDF2 salt, base64url. */
      s: string
      /** PBKDF2 iterations. */
      it: number
    })

export class ShareFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShareFormatError'
  }
}

export class ShareExpiredError extends Error {
  readonly expiredAt: number
  constructor(expiredAt: number) {
    super('This share link has expired.')
    this.name = 'ShareExpiredError'
    this.expiredAt = expiredAt
  }
}

function toB64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromB64Url(s: string): Uint8Array {
  const b64 = s.replaceAll('-', '+').replaceAll('_', '/')
  return fromBase64(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
}

async function importRawKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Returns the fragment (without '#'): "s=<base64url envelope>". */
export async function createShareFragment(
  payload: SharePayload,
  passphrase: string | null,
  iterations = DEFAULT_ITERATIONS,
): Promise<string> {
  let key: CryptoKey
  let head: { m: 'key'; k: string } | { m: 'pass'; s: string; it: number }
  if (passphrase) {
    const salt = generateSalt()
    key = await deriveKey(passphrase, salt, iterations)
    head = { m: 'pass', s: toB64Url(salt), it: iterations }
  } else {
    const raw = randomBytes(32)
    key = await importRawKey(raw)
    head = { m: 'key', k: toB64Url(raw) }
  }
  const { iv, ciphertext } = await encryptJson(key, payload)
  const envelope: ShareEnvelope = { v: 1, ...head, iv: toB64Url(iv), ct: toB64Url(ciphertext) }
  return `s=${toB64Url(new TextEncoder().encode(JSON.stringify(envelope)))}`
}

export interface ParsedShare {
  envelope: ShareEnvelope
  needsPassphrase: boolean
}

/** Returns null when the hash carries no share; throws ShareFormatError on a
 *  malformed one. */
export function parseShareFragment(hash: string): ParsedShare | null {
  const fragment = hash.replace(/^#/, '')
  if (!fragment.startsWith('s=')) return null
  let envelope: unknown
  try {
    envelope = JSON.parse(new TextDecoder().decode(fromB64Url(fragment.slice(2))))
  } catch {
    throw new ShareFormatError('This share link is damaged or incomplete.')
  }
  if (typeof envelope !== 'object' || envelope === null) throw new ShareFormatError('Invalid share envelope.')
  const e = envelope as Record<string, unknown>
  if (e.v !== 1 || (e.m !== 'key' && e.m !== 'pass') || typeof e.iv !== 'string' || typeof e.ct !== 'string') {
    throw new ShareFormatError('Invalid share envelope.')
  }
  if (e.m === 'key' && typeof e.k !== 'string') throw new ShareFormatError('Invalid share envelope.')
  if (e.m === 'pass' && (typeof e.s !== 'string' || typeof e.it !== 'number')) {
    throw new ShareFormatError('Invalid share envelope.')
  }
  return { envelope: envelope as ShareEnvelope, needsPassphrase: e.m === 'pass' }
}

/** Throws VaultDecryptError on a wrong passphrase or tampered data, and
 *  ShareExpiredError once the payload's expiry has passed. In pass mode the
 *  KDF must run before the payload is readable, so a wrong passphrase on an
 *  expired link still surfaces as VaultDecryptError. */
export async function openShare(
  envelope: ShareEnvelope,
  passphrase?: string,
  now = Date.now(),
): Promise<SharePayload> {
  const key =
    envelope.m === 'pass'
      ? await deriveKey(passphrase ?? '', fromB64Url(envelope.s), envelope.it)
      : await importRawKey(fromB64Url(envelope.k))
  const payload = await decryptJson<SharePayload>(key, fromB64Url(envelope.iv), fromB64Url(envelope.ct))
  if (typeof payload.exp === 'number' && now > payload.exp) throw new ShareExpiredError(payload.exp)
  return payload
}

export function buildShareUrl(fragment: string): string {
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}#${fragment}`
}
