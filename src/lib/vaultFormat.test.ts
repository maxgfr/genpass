import { describe, expect, it } from 'vitest'
import {
  VaultFormatError,
  fromBase64,
  parseVaultFile,
  serializeVault,
  toBase64,
  type EncryptedVaultFile,
} from './vaultFormat'

const validFile: EncryptedVaultFile = {
  version: 1,
  kdf: 'PBKDF2-SHA256',
  iterations: 600_000,
  salt: toBase64(new Uint8Array(16).fill(7)),
  iv: toBase64(new Uint8Array(12).fill(9)),
  ciphertext: toBase64(new Uint8Array([1, 2, 3, 4])),
}

describe('base64', () => {
  it('round-trips arbitrary bytes including 0x00 and 0xff', () => {
    const bytes = new Uint8Array([0, 255, 128, 1, 254, 0, 42])
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })

  it('round-trips large buffers (chunked encoding)', () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 256)
    expect(fromBase64(toBase64(big))).toEqual(big)
  })

  it('throws on invalid base64 input', () => {
    expect(() => fromBase64('not base64 !!!')).toThrow()
  })
})

describe('serializeVault / parseVaultFile', () => {
  it('round-trips a valid file', () => {
    expect(parseVaultFile(serializeVault(validFile))).toEqual(validFile)
  })

  it.each([
    ['bad JSON', 'not json {'],
    ['non-object', '"str"'],
    ['missing salt', JSON.stringify({ ...validFile, salt: undefined })],
    ['unknown version', JSON.stringify({ ...validFile, version: 2 })],
    ['unknown kdf', JSON.stringify({ ...validFile, kdf: 'argon2' })],
    ['non-numeric iterations', JSON.stringify({ ...validFile, iterations: 'many' })],
    ['non-positive iterations', JSON.stringify({ ...validFile, iterations: 0 })],
    ['non-string ciphertext', JSON.stringify({ ...validFile, ciphertext: 42 })],
  ])('rejects %s with VaultFormatError', (_name, json) => {
    expect(() => parseVaultFile(json)).toThrow(VaultFormatError)
  })
})
