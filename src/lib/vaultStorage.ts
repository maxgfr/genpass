import { parseVaultFile, serializeVault, type EncryptedVaultFile } from './vaultFormat'

export const VAULT_STORAGE_KEY = 'genpass.vault'

export class StorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageError'
  }
}

function defaultStorage(): Storage {
  return globalThis.localStorage
}

/**
 * Returns null only when no vault exists. Corrupted data throws
 * VaultFormatError — it must never read as "uninitialized", or the next save
 * would silently overwrite what might still be recoverable.
 */
export function loadVaultFile(storage: Storage = defaultStorage()): EncryptedVaultFile | null {
  const raw = storage.getItem(VAULT_STORAGE_KEY)
  if (raw === null) return null
  return parseVaultFile(raw)
}

export function saveVaultFile(file: EncryptedVaultFile, storage: Storage = defaultStorage()): void {
  try {
    storage.setItem(VAULT_STORAGE_KEY, serializeVault(file))
  } catch (cause) {
    throw new StorageError(`Could not persist the vault: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

export function clearVault(storage: Storage = defaultStorage()): void {
  storage.removeItem(VAULT_STORAGE_KEY)
}
