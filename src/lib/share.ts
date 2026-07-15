// Client-side secret sharing. There is no server, so the encrypted secret
// travels INSIDE the link's fragment (#s=…) — fragments are never sent to the
// web server. Two modes:
//   'key'  — a random 256-bit key is embedded in the fragment: the link alone
//            opens the secret.
//   'pass' — the key is derived from a passphrase (PBKDF2) communicated over
//            a separate channel: the link alone is useless.
// Honest limits (stated in the UI): no expiry and no one-time view are
// possible without a server, and links persist in browser history.

import { randomBytes } from './random'
import { decryptJson, deriveKey, encryptJson, generateSalt } from './vaultCrypto'
import { fromBase64, toBase64 } from './vaultFormat'

export const SHARE_ITERATIONS = 600_000

export interface SharePayload {
  secret: string
  label?: string
}

export interface ShareEnvelope {
  v: 1
  m: 'key' | 'pass'
  /** Raw AES key, base64url (key mode only). */
  k?: string
  /** PBKDF2 salt, base64url (pass mode only). */
  s?: string
  /** PBKDF2 iterations (pass mode only). */
  it?: number
  iv: string
  ct: string
}

export class ShareFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShareFormatError'
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
  iterations = SHARE_ITERATIONS,
): Promise<string> {
  let key: CryptoKey
  let envelopeBase: Pick<ShareEnvelope, 'm' | 'k' | 's' | 'it'>
  if (passphrase) {
    const salt = generateSalt()
    key = await deriveKey(passphrase, salt, iterations)
    envelopeBase = { m: 'pass', s: toB64Url(salt), it: iterations }
  } else {
    const raw = randomBytes(32)
    key = await importRawKey(raw)
    envelopeBase = { m: 'key', k: toB64Url(raw) }
  }
  const { iv, ciphertext } = await encryptJson(key, payload)
  const envelope: ShareEnvelope = { v: 1, ...envelopeBase, iv: toB64Url(iv), ct: toB64Url(ciphertext) }
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

/** Throws VaultDecryptError on a wrong passphrase or tampered data. */
export async function openShare(envelope: ShareEnvelope, passphrase?: string): Promise<SharePayload> {
  const key =
    envelope.m === 'pass'
      ? await deriveKey(passphrase ?? '', fromB64Url(envelope.s!), envelope.it!)
      : await importRawKey(fromB64Url(envelope.k!))
  return decryptJson<SharePayload>(key, fromB64Url(envelope.iv), fromB64Url(envelope.ct))
}

export function buildShareUrl(fragment: string): string {
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}#${fragment}`
}
