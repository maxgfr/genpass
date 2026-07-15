import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/helpers'
import { StorageError, VAULT_STORAGE_KEY, clearVault, loadVaultFile, saveVaultFile } from './vaultStorage'
import { VaultFormatError, toBase64, type EncryptedVaultFile } from './vaultFormat'

const file: EncryptedVaultFile = {
  version: 1,
  kdf: 'PBKDF2-SHA256',
  iterations: 1000,
  salt: toBase64(new Uint8Array(16)),
  iv: toBase64(new Uint8Array(12)),
  ciphertext: toBase64(new Uint8Array([1, 2, 3])),
}

describe('vaultStorage', () => {
  it('returns null when no vault is stored', () => {
    expect(loadVaultFile(memoryStorage())).toBeNull()
  })

  it('round-trips save → load', () => {
    const storage = memoryStorage()
    saveVaultFile(file, storage)
    expect(loadVaultFile(storage)).toEqual(file)
  })

  it('clearVault removes the blob', () => {
    const storage = memoryStorage()
    saveVaultFile(file, storage)
    clearVault(storage)
    expect(loadVaultFile(storage)).toBeNull()
  })

  it('throws VaultFormatError on corrupted stored data instead of pretending no vault exists', () => {
    // A corrupted blob must never read as "uninitialized" — the next save would
    // silently destroy the user's (possibly recoverable) data.
    const storage = memoryStorage()
    storage.setItem(VAULT_STORAGE_KEY, '{corrupt')
    expect(() => loadVaultFile(storage)).toThrow(VaultFormatError)
  })

  it('surfaces quota failures as StorageError', () => {
    const storage = memoryStorage()
    storage.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError')
    }
    expect(() => saveVaultFile(file, storage)).toThrow(StorageError)
  })
})
