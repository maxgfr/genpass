import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_ITERATIONS,
  deriveKey,
  generateSalt,
  openVault,
  sealWithKey,
} from '../lib/vaultCrypto'
import {
  parseVaultFile,
  serializeVault,
  toBase64,
  type EncryptedVaultFile,
  type VaultEntry,
} from '../lib/vaultFormat'
import { clearVault, loadVaultFile, saveVaultFile } from '../lib/vaultStorage'
import { removeEntry, upsertEntry, vaultReducer, type VaultState } from './vaultReducer'

export interface NewEntry {
  label: string
  site?: string
  username?: string
  password: string
  notes?: string
}

export interface VaultApi {
  state: VaultState
  /** True when stored vault data exists but cannot be parsed. */
  corrupt: boolean
  createVault: (masterPassword: string) => Promise<void>
  unlock: (masterPassword: string) => Promise<void>
  lock: () => void
  addEntry: (entry: NewEntry) => Promise<void>
  updateEntry: (entry: VaultEntry) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  changeMasterPassword: (current: string, next: string) => Promise<void>
  exportBlob: () => string | null
  importReplace: (json: string, password: string) => Promise<void>
  /** Destructive reset: deletes the stored vault and every entry in it.
   *  The only way out of a forgotten master password or a corrupt blob. */
  eraseVault: () => void
}

const VaultContext = createContext<VaultApi | null>(null)

interface VaultProviderProps {
  children: ReactNode
  /** Production default 1M; tests pass a low value. */
  iterations?: number
}

export function VaultProvider({ children, iterations = DEFAULT_ITERATIONS }: VaultProviderProps) {
  const [state, dispatch] = useReducer(vaultReducer, { status: 'loading' })
  const [corrupt, setCorrupt] = useState(false)
  // The key lives ONLY here — never in reducer state, gone on lock.
  const keyRef = useRef<CryptoKey | null>(null)
  // Serialize saves so two rapid mutations cannot interleave writes.
  const saveChain = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    try {
      dispatch({ type: 'INITIALIZED', file: loadVaultFile() })
    } catch {
      // Corrupted blob: refuse to treat as uninitialized — a save would
      // overwrite possibly recoverable data.
      setCorrupt(true)
    }
  }, [])

  const persist = useCallback(
    (key: CryptoKey, base: Pick<EncryptedVaultFile, 'salt' | 'iterations'>, entries: VaultEntry[]) => {
      const task = saveChain.current.then(async () => {
        const file = await sealWithKey(key, base, { entries })
        saveVaultFile(file)
        return file
      })
      saveChain.current = task.catch(() => {})
      return task
    },
    [],
  )

  const createVault = useCallback(
    async (masterPassword: string) => {
      const salt = generateSalt()
      const key = await deriveKey(masterPassword, salt, iterations)
      const file = await sealWithKey(key, { salt: toBase64(salt), iterations }, { entries: [] })
      saveVaultFile(file)
      keyRef.current = key
      dispatch({ type: 'CREATED', file })
    },
    [iterations],
  )

  const unlock = useCallback(
    async (masterPassword: string) => {
      if (state.status !== 'locked') throw new Error('Vault is not locked')
      const { key, payload } = await openVault(state.file, masterPassword)
      keyRef.current = key
      dispatch({ type: 'UNLOCKED', entries: payload.entries })
    },
    [state],
  )

  const lock = useCallback(() => {
    keyRef.current = null
    dispatch({ type: 'LOCK' })
  }, [])

  const mutateEntries = useCallback(
    async (mutate: (entries: readonly VaultEntry[]) => VaultEntry[]) => {
      if (state.status !== 'unlocked' || !keyRef.current) throw new Error('Vault is locked')
      const entries = mutate(state.entries)
      const file = await persist(keyRef.current, state.file, entries)
      dispatch({ type: 'SAVED', file, entries })
    },
    [state, persist],
  )

  const addEntry = useCallback(
    (entry: NewEntry) =>
      mutateEntries((entries) => {
        const now = Date.now()
        return upsertEntry(entries, { ...entry, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
      }),
    [mutateEntries],
  )

  const updateEntry = useCallback(
    (entry: VaultEntry) =>
      mutateEntries((entries) => upsertEntry(entries, { ...entry, updatedAt: Date.now() })),
    [mutateEntries],
  )

  const deleteEntry = useCallback(
    (id: string) => mutateEntries((entries) => removeEntry(entries, id)),
    [mutateEntries],
  )

  const changeMasterPassword = useCallback(
    async (current: string, next: string) => {
      if (state.status !== 'unlocked') throw new Error('Vault is locked')
      // Verify the current password against the stored file before rekeying.
      await openVault(state.file, current)
      const salt = generateSalt()
      const key = await deriveKey(next, salt, iterations)
      const file = await sealWithKey(key, { salt: toBase64(salt), iterations }, { entries: state.entries })
      saveVaultFile(file)
      keyRef.current = key
      dispatch({ type: 'SAVED', file, entries: state.entries })
    },
    [state, iterations],
  )

  const exportBlob = useCallback(() => {
    if (state.status === 'locked' || state.status === 'unlocked') return serializeVault(state.file)
    return null
  }, [state])

  const importReplace = useCallback(async (json: string, password: string) => {
    const file = parseVaultFile(json)
    const { key, payload } = await openVault(file, password)
    saveVaultFile(file)
    keyRef.current = key
    dispatch({ type: 'REPLACED', file, entries: payload.entries })
  }, [])

  const eraseVault = useCallback(() => {
    clearVault()
    keyRef.current = null
    setCorrupt(false)
    dispatch({ type: 'ERASED' })
  }, [])

  const api = useMemo<VaultApi>(
    () => ({
      state,
      corrupt,
      createVault,
      unlock,
      lock,
      addEntry,
      updateEntry,
      deleteEntry,
      changeMasterPassword,
      exportBlob,
      importReplace,
      eraseVault,
    }),
    [state, corrupt, createVault, unlock, lock, addEntry, updateEntry, deleteEntry, changeMasterPassword, exportBlob, importReplace, eraseVault],
  )

  return <VaultContext.Provider value={api}>{children}</VaultContext.Provider>
}

export function useVault(): VaultApi {
  const api = useContext(VaultContext)
  if (!api) throw new Error('useVault must be used inside <VaultProvider>')
  return api
}
