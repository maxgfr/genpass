import { describe, expect, it } from 'vitest'
import { TEST_ITERATIONS } from '../test/helpers'
import { VaultDecryptError } from './vaultCrypto'
import {
  ShareExpiredError,
  ShareFormatError,
  createShareFragment,
  openShare,
  parseShareFragment,
} from './share'

const payload = { secret: 'S3cret-Émoji-密码!', label: 'Wi-Fi at home' }

describe('share round trips', () => {
  it('key mode: the fragment alone opens the secret', async () => {
    const fragment = await createShareFragment(payload, null)
    const parsed = parseShareFragment(`#${fragment}`)!
    expect(parsed.needsPassphrase).toBe(false)
    await expect(openShare(parsed.envelope)).resolves.toEqual(payload)
  })

  it('passphrase mode: requires the passphrase', async () => {
    const fragment = await createShareFragment(payload, 'open sesame', TEST_ITERATIONS)
    const parsed = parseShareFragment(fragment)!
    expect(parsed.needsPassphrase).toBe(true)
    await expect(openShare(parsed.envelope, 'open sesame')).resolves.toEqual(payload)
  })

  it('rejects a wrong passphrase', async () => {
    const fragment = await createShareFragment(payload, 'right', TEST_ITERATIONS)
    const parsed = parseShareFragment(fragment)!
    await expect(openShare(parsed.envelope, 'wrong')).rejects.toBeInstanceOf(VaultDecryptError)
  })

  it('rejects tampered ciphertext', async () => {
    const fragment = await createShareFragment(payload, null)
    const parsed = parseShareFragment(fragment)!
    const ct = parsed.envelope.ct
    parsed.envelope.ct = ct.slice(0, -2) + (ct.endsWith('A') ? 'BB' : 'AA')
    await expect(openShare(parsed.envelope)).rejects.toThrow()
  })

  it('fragments are URL-safe (no +, /, =, #)', async () => {
    const fragment = await createShareFragment(payload, null)
    expect(fragment).toMatch(/^s=[A-Za-z0-9_-]+$/)
  })
})

describe('share expiry', () => {
  const exp = 1_700_000_000_000

  it('round-trips exp and opens before the deadline', async () => {
    const fragment = await createShareFragment({ ...payload, exp }, null)
    const parsed = parseShareFragment(fragment)!
    await expect(openShare(parsed.envelope, undefined, exp - 1)).resolves.toEqual({ ...payload, exp })
  })

  it('key mode: rejects an expired link with ShareExpiredError carrying the deadline', async () => {
    const fragment = await createShareFragment({ ...payload, exp }, null)
    const parsed = parseShareFragment(fragment)!
    const err = await openShare(parsed.envelope, undefined, exp + 1).then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(ShareExpiredError)
    expect((err as ShareExpiredError).expiredAt).toBe(exp)
  })

  it('pass mode: the right passphrase surfaces expiry, a wrong one stays a decrypt error', async () => {
    const fragment = await createShareFragment({ ...payload, exp }, 'open sesame', TEST_ITERATIONS)
    const parsed = parseShareFragment(fragment)!
    await expect(openShare(parsed.envelope, 'open sesame', exp + 1)).rejects.toBeInstanceOf(
      ShareExpiredError,
    )
    await expect(openShare(parsed.envelope, 'wrong', exp + 1)).rejects.toBeInstanceOf(
      VaultDecryptError,
    )
  })

  it('legacy links without exp never expire', async () => {
    const fragment = await createShareFragment(payload, null)
    const parsed = parseShareFragment(fragment)!
    await expect(openShare(parsed.envelope, undefined, Date.UTC(3000, 0))).resolves.toEqual(payload)
  })
})

describe('parseShareFragment', () => {
  it('returns null when the hash carries no share', () => {
    expect(parseShareFragment('')).toBeNull()
    expect(parseShareFragment('#')).toBeNull()
    expect(parseShareFragment('#other=1')).toBeNull()
  })

  it('throws ShareFormatError on a malformed share payload', () => {
    expect(() => parseShareFragment('#s=!!!not-base64!!!')).toThrow(ShareFormatError)
    expect(() => parseShareFragment('#s=aGVsbG8')).toThrow(ShareFormatError) // "hello", not an envelope
  })
})
