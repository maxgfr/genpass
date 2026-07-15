// Pure vault state machine. The CryptoKey deliberately does NOT live here —
// VaultProvider keeps it in a ref. Every persisted mutation arrives as SAVED
// with the already-encrypted file: the reducer can never claim a save that
// did not happen.

import type { EncryptedVaultFile, VaultEntry } from '../lib/vaultFormat'

export type VaultState =
  | { status: 'loading' }
  | { status: 'uninitialized' }
  | { status: 'locked'; file: EncryptedVaultFile }
  | { status: 'unlocked'; file: EncryptedVaultFile; entries: VaultEntry[] }

export type VaultAction =
  | { type: 'INITIALIZED'; file: EncryptedVaultFile | null }
  | { type: 'CREATED'; file: EncryptedVaultFile }
  | { type: 'UNLOCKED'; entries: VaultEntry[] }
  | { type: 'LOCK' }
  | { type: 'SAVED'; file: EncryptedVaultFile; entries: VaultEntry[] }
  | { type: 'REPLACED'; file: EncryptedVaultFile; entries: VaultEntry[] }

function invalid(state: VaultState, action: VaultAction): never {
  throw new Error(`Invalid vault transition: ${action.type} while ${state.status}`)
}

export function vaultReducer(state: VaultState, action: VaultAction): VaultState {
  switch (action.type) {
    case 'INITIALIZED':
      if (state.status !== 'loading') invalid(state, action)
      return action.file === null ? { status: 'uninitialized' } : { status: 'locked', file: action.file }
    case 'CREATED':
      if (state.status !== 'uninitialized') invalid(state, action)
      return { status: 'unlocked', file: action.file, entries: [] }
    case 'UNLOCKED':
      if (state.status !== 'locked') invalid(state, action)
      return { status: 'unlocked', file: state.file, entries: action.entries }
    case 'LOCK':
      if (state.status !== 'unlocked') invalid(state, action)
      return { status: 'locked', file: state.file }
    case 'SAVED':
      if (state.status !== 'unlocked') invalid(state, action)
      return { status: 'unlocked', file: action.file, entries: action.entries }
    case 'REPLACED':
      // Import installs a decrypted vault wholesale from any settled state.
      if (state.status === 'loading') invalid(state, action)
      return { status: 'unlocked', file: action.file, entries: action.entries }
  }
}

export function upsertEntry(entries: readonly VaultEntry[], entry: VaultEntry): VaultEntry[] {
  const index = entries.findIndex((e) => e.id === entry.id)
  if (index === -1) return [...entries, entry]
  const next = [...entries]
  next[index] = entry
  return next
}

export function removeEntry(entries: readonly VaultEntry[], id: string): VaultEntry[] {
  return entries.filter((e) => e.id !== id)
}
