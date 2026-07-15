import { describe, expect, it } from 'vitest'
import { TEST_ITERATIONS } from '../test/helpers'
import { VaultDecryptError } from './vaultCrypto'
import {
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
