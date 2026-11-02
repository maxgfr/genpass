import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/helpers'
import {
  StorageError,
  VAULT_STORAGE_KEY,
  clearVault,
  loadVaultFile,
  loadVaultRaw,
  saveVaultFile,
} from './vaultStorage'
import { VaultFormatError, toBase64, type EncryptedVaultFile } from './vaultFormat'

const file: EncryptedVaultFile = {
  version: 1,
  kdf: 'PBKDF2-SHA256',
  iterations: 1000,
  salt: toBase64(new Uint8Array(16)),
  iv: toBase64(new Uint8Array(12)),
  ciphertext: toBase64(new Uint8Array([1, 2, 3])),
}

function backends() {
  return { idb: new IDBFactory(), storage: memoryStorage() }
}

function fullStorage(): Storage {
  const storage = memoryStorage()
  storage.setItem = () => {
    throw new DOMException('quota', 'QuotaExceededError')
  }
  return storage
}

describe('vaultStorage', () => {
  it('returns null when no vault is stored', async () => {
    expect(await loadVaultFile(backends())).toBeNull()
  })

  it('round-trips save → load, in IndexedDB rather than localStorage', async () => {
    const b = backends()
    await saveVaultFile(file, b)
    expect(await loadVaultFile(b)).toEqual(file)
    expect(b.storage.getItem(VAULT_STORAGE_KEY)).toBeNull()
  })

  it('saves even when the shared localStorage is full', async () => {
    const b = { idb: new IDBFactory(), storage: fullStorage() }
    await saveVaultFile(file, b)
    expect(await loadVaultFile(b)).toEqual(file)
  })

  it('moves a vault kept in localStorage by an earlier version into IndexedDB', async () => {
    const b = backends()
    b.storage.setItem(VAULT_STORAGE_KEY, JSON.stringify(file))
    expect(await loadVaultFile(b)).toEqual(file)
    expect(b.storage.getItem(VAULT_STORAGE_KEY)).toBeNull()
    // Still there on the next load, from IndexedDB alone.
    expect(await loadVaultFile(b)).toEqual(file)
  })

  it('migration keeps a corrupted blob as is, so it still reads as corrupt', async () => {
    const b = backends()
    b.storage.setItem(VAULT_STORAGE_KEY, '{corrupt')
    await expect(loadVaultFile(b)).rejects.toThrow(VaultFormatError)
    expect(await loadVaultRaw(b)).toBe('{corrupt')
  })

  it('falls back to localStorage without IndexedDB', async () => {
    const b = { idb: null, storage: memoryStorage() }
    await saveVaultFile(file, b)
    expect(b.storage.getItem(VAULT_STORAGE_KEY)).not.toBeNull()
    expect(await loadVaultFile(b)).toEqual(file)
  })

  it('clearVault removes the blob, wherever it is', async () => {
    const b = backends()
    await saveVaultFile(file, b)
    b.storage.setItem(VAULT_STORAGE_KEY, JSON.stringify(file))
    await clearVault(b)
    expect(await loadVaultFile(b)).toBeNull()
    expect(b.storage.getItem(VAULT_STORAGE_KEY)).toBeNull()
  })

  it('throws VaultFormatError on corrupted stored data instead of pretending no vault exists', async () => {
    // A corrupted blob must never read as "uninitialized" — the next save would
    // silently destroy the user's (possibly recoverable) data.
    const b = { idb: null, storage: memoryStorage() }
    b.storage.setItem(VAULT_STORAGE_KEY, '{corrupt')
    await expect(loadVaultFile(b)).rejects.toThrow(VaultFormatError)
  })

  it('surfaces quota failures as StorageError', async () => {
    await expect(saveVaultFile(file, { idb: null, storage: fullStorage() })).rejects.toThrow(StorageError)
  })
})
