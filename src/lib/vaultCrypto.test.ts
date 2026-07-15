import { describe, expect, it } from 'vitest'
import { TEST_ITERATIONS } from '../test/helpers'
import {
  VaultDecryptError,
  decryptJson,
  deriveKey,
  encryptJson,
  generateIv,
  generateSalt,
  openVault,
  sealVault,
  sealWithKey,
} from './vaultCrypto'
import type { VaultPayload } from './vaultFormat'

const payload: VaultPayload = {
  entries: [
    {
      id: 'a1',
      label: 'Email',
      site: 'mail.example.com',
      username: 'max',
      password: 'S3cr3t!éπ密码',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
  ],
}

describe('key derivation and sizes', () => {
  it('generates 16-byte salts and 12-byte IVs', () => {
    expect(generateSalt()).toHaveLength(16)
    expect(generateIv()).toHaveLength(12)
  })

  it('derives a non-extractable AES-GCM key', async () => {
    const key = await deriveKey('hunter2', generateSalt(), TEST_ITERATIONS)
    expect(key.extractable).toBe(false)
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
  })
})

describe('encryptJson / decryptJson', () => {
  it('round-trips a payload, including non-ASCII', async () => {
    const key = await deriveKey('hunter2', generateSalt(), TEST_ITERATIONS)
    const { iv, ciphertext } = await encryptJson(key, payload)
    await expect(decryptJson(key, iv, ciphertext)).resolves.toEqual(payload)
  })

  it('uses a fresh IV per call — same payload never encrypts identically', async () => {
    const key = await deriveKey('hunter2', generateSalt(), TEST_ITERATIONS)
    const a = await encryptJson(key, payload)
    const b = await encryptJson(key, payload)
    expect(Buffer.from(a.iv).equals(Buffer.from(b.iv))).toBe(false)
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(false)
  })

  it('rejects a wrong password with VaultDecryptError', async () => {
    const salt = generateSalt()
    const right = await deriveKey('hunter2', salt, TEST_ITERATIONS)
    const wrong = await deriveKey('hunter3', salt, TEST_ITERATIONS)
    const { iv, ciphertext } = await encryptJson(right, payload)
    await expect(decryptJson(wrong, iv, ciphertext)).rejects.toBeInstanceOf(VaultDecryptError)
  })

  it('rejects tampered ciphertext (GCM auth)', async () => {
    const key = await deriveKey('hunter2', generateSalt(), TEST_ITERATIONS)
    const { iv, ciphertext } = await encryptJson(key, payload)
    ciphertext[5]! ^= 0xff
    await expect(decryptJson(key, iv, ciphertext)).rejects.toBeInstanceOf(VaultDecryptError)
  })

  it('keys from different salts cannot decrypt each other', async () => {
    const keyA = await deriveKey('hunter2', generateSalt(), TEST_ITERATIONS)
    const keyB = await deriveKey('hunter2', generateSalt(), TEST_ITERATIONS)
    const { iv, ciphertext } = await encryptJson(keyA, payload)
    await expect(decryptJson(keyB, iv, ciphertext)).rejects.toBeInstanceOf(VaultDecryptError)
  })
})

describe('sealVault / openVault (file-level round trip)', () => {
  it('seals with a fresh salt and opens with the same password', async () => {
    const file = await sealVault(payload, 'correct horse', TEST_ITERATIONS)
    expect(file.version).toBe(1)
    expect(file.kdf).toBe('PBKDF2-SHA256')
    expect(file.iterations).toBe(TEST_ITERATIONS)
    const opened = await openVault(file, 'correct horse')
    expect(opened.payload).toEqual(payload)
  })

  it('openVault rejects the wrong password', async () => {
    const file = await sealVault(payload, 'correct horse', TEST_ITERATIONS)
    await expect(openVault(file, 'wrong horse')).rejects.toBeInstanceOf(VaultDecryptError)
  })

  it('sealWithKey reuses key and salt for cheap mutations', async () => {
    const file = await sealVault(payload, 'pw', TEST_ITERATIONS)
    const { key } = await openVault(file, 'pw')
    const next: VaultPayload = { entries: [] }
    const resealed = await sealWithKey(key, file, next)
    expect(resealed.salt).toBe(file.salt)
    expect(resealed.iv).not.toBe(file.iv) // fresh IV even when reusing the key
    const reopened = await openVault(resealed, 'pw')
    expect(reopened.payload).toEqual(next)
  })
})
