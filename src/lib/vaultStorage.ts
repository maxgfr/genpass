import { parseVaultFile, serializeVault, type EncryptedVaultFile } from './vaultFormat'

// Every maxgfr.github.io app shares one origin, so one localStorage quota:
// another site filling it must not stop the vault from saving. The vault lives
// in its own IndexedDB database; localStorage is only where earlier versions
// kept it (moved on first load, then removed) and the fallback when IndexedDB
// is unavailable.
export const VAULT_STORAGE_KEY = 'genpass.vault'
export const VAULT_DB_NAME = 'genpass-vault'
const STORE = 'kv'
const RECORD = 'vault'

export class StorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageError'
  }
}

/** Injectable for tests; defaults to the browser's IndexedDB and localStorage. */
export interface VaultBackends {
  idb?: IDBFactory | null
  storage?: Storage
}

function resolve(b: VaultBackends = {}): { idb: IDBFactory | null; storage: Storage } {
  return {
    idb: b.idb === undefined ? (globalThis.indexedDB ?? null) : b.idb,
    storage: b.storage ?? globalThis.localStorage,
  }
}

function openDb(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const req = idb.open(VAULT_DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => ok(req.result)
    req.onerror = () => fail(req.error)
    req.onblocked = () => fail(new Error('IndexedDB blocked'))
  })
}

async function withStore<T>(
  idb: IDBFactory | IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = 'transaction' in idb ? idb : await openDb(idb)
  try {
    return await new Promise<T>((ok, fail) => {
      const tx = db.transaction(STORE, mode)
      const req = run(tx.objectStore(STORE))
      tx.oncomplete = () => ok(req.result as T)
      tx.onerror = tx.onabort = () => fail(tx.error)
    })
  } finally {
    db.close()
  }
}

/** The stored vault as written (null when none), migrating a localStorage copy into IndexedDB. */
export async function loadVaultRaw(backends?: VaultBackends): Promise<string | null> {
  const { idb, storage } = resolve(backends)
  const legacy = () => storage.getItem(VAULT_STORAGE_KEY)
  if (!idb) return legacy()
  let raw: string | null
  try {
    raw = (await withStore<string | undefined>(idb, 'readonly', (s) => s.get(RECORD))) ?? null
  } catch {
    return legacy() // IndexedDB unavailable: the vault stays in localStorage
  }
  const old = legacy()
  if (raw === null && old !== null) {
    try {
      await withStore(idb, 'readwrite', (s) => s.put(old, RECORD))
    } catch {
      return old // could not move it: keep using the localStorage copy
    }
    raw = old
  }
  // Moved (now or by an interrupted earlier run): the key is genpass's own, drop it.
  if (old !== null) storage.removeItem(VAULT_STORAGE_KEY)
  return raw
}

/**
 * Returns null only when no vault exists. Corrupted data throws
 * VaultFormatError — it must never read as "uninitialized", or the next save
 * would silently overwrite what might still be recoverable.
 */
export async function loadVaultFile(backends?: VaultBackends): Promise<EncryptedVaultFile | null> {
  const raw = await loadVaultRaw(backends)
  if (raw === null) return null
  return parseVaultFile(raw)
}

export async function saveVaultFile(file: EncryptedVaultFile, backends?: VaultBackends): Promise<void> {
  const { idb, storage } = resolve(backends)
  const raw = serializeVault(file)
  let idbError: unknown = null
  if (idb) {
    try {
      await withStore(idb, 'readwrite', (s) => s.put(raw, RECORD))
      return
    } catch (cause) {
      idbError = cause
    }
  }
  try {
    storage.setItem(VAULT_STORAGE_KEY, raw)
  } catch (cause) {
    const reason = idbError ?? cause
    throw new StorageError(`Could not persist the vault: ${reason instanceof Error ? reason.message : String(reason)}`)
  }
}

/** Deletes the stored vault (IndexedDB record and any localStorage copy). Throws if it may remain. */
export async function clearVault(backends?: VaultBackends): Promise<void> {
  const { idb, storage } = resolve(backends)
  storage.removeItem(VAULT_STORAGE_KEY)
  if (!idb) return
  let db: IDBDatabase
  try {
    db = await openDb(idb)
  } catch {
    return // an IndexedDB that cannot be opened holds no vault this app could load
  }
  try {
    await withStore(db, 'readwrite', (s) => s.delete(RECORD))
  } catch (cause) {
    throw new StorageError(`Could not erase the vault: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}
