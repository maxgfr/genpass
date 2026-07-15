import { describe, expect, it } from 'vitest'
import { toBase64, type EncryptedVaultFile, type VaultEntry } from '../lib/vaultFormat'
import { removeEntry, upsertEntry, vaultReducer, type VaultState } from './vaultReducer'

const file: EncryptedVaultFile = {
  version: 1,
  kdf: 'PBKDF2-SHA256',
  iterations: 1000,
  salt: toBase64(new Uint8Array(16)),
  iv: toBase64(new Uint8Array(12)),
  ciphertext: toBase64(new Uint8Array([1])),
}

const entry: VaultEntry = {
  id: 'e1',
  label: 'Email',
  password: 'pw',
  createdAt: 1,
  updatedAt: 1,
}

describe('vaultReducer transitions', () => {
  const loading: VaultState = { status: 'loading' }

  it('INITIALIZED with null → uninitialized; with a file → locked', () => {
    expect(vaultReducer(loading, { type: 'INITIALIZED', file: null })).toEqual({ status: 'uninitialized' })
    expect(vaultReducer(loading, { type: 'INITIALIZED', file })).toEqual({ status: 'locked', file })
  })

  it('CREATED from uninitialized → unlocked and empty', () => {
    const state = vaultReducer({ status: 'uninitialized' }, { type: 'CREATED', file })
    expect(state).toEqual({ status: 'unlocked', file, entries: [] })
  })

  it('UNLOCKED from locked carries the decrypted entries', () => {
    const state = vaultReducer({ status: 'locked', file }, { type: 'UNLOCKED', entries: [entry] })
    expect(state).toEqual({ status: 'unlocked', file, entries: [entry] })
  })

  it('LOCK from unlocked retains the file but no entries anywhere in state', () => {
    const state = vaultReducer(
      { status: 'unlocked', file, entries: [entry] },
      { type: 'LOCK' },
    )
    expect(state).toEqual({ status: 'locked', file })
    expect(JSON.stringify(state)).not.toContain('"pw"')
  })

  it('SAVED updates both entries and encrypted file after a persisted mutation', () => {
    const newFile = { ...file, iv: toBase64(new Uint8Array(12).fill(3)) }
    const state = vaultReducer(
      { status: 'unlocked', file, entries: [] },
      { type: 'SAVED', file: newFile, entries: [entry] },
    )
    expect(state).toEqual({ status: 'unlocked', file: newFile, entries: [entry] })
  })

  it('REPLACED installs an imported vault from any settled state', () => {
    const newFile = { ...file, salt: toBase64(new Uint8Array(16).fill(9)) }
    for (const from of [
      { status: 'uninitialized' } as VaultState,
      { status: 'locked', file } as VaultState,
      { status: 'unlocked', file, entries: [entry] } as VaultState,
    ]) {
      const state = vaultReducer(from, { type: 'REPLACED', file: newFile, entries: [entry] })
      expect(state).toEqual({ status: 'unlocked', file: newFile, entries: [entry] })
    }
    expect(() => vaultReducer({ status: 'loading' }, { type: 'REPLACED', file: newFile, entries: [] })).toThrow()
  })

  it('throws on invalid transitions — fail loud, not silent', () => {
    expect(() => vaultReducer({ status: 'locked', file }, { type: 'SAVED', file, entries: [] })).toThrow()
    expect(() => vaultReducer({ status: 'uninitialized' }, { type: 'UNLOCKED', entries: [] })).toThrow()
    expect(() => vaultReducer({ status: 'locked', file }, { type: 'CREATED', file })).toThrow()
    expect(() => vaultReducer({ status: 'uninitialized' }, { type: 'LOCK' })).toThrow()
  })
})

describe('entry helpers', () => {
  it('upsertEntry inserts new and replaces existing by id', () => {
    const inserted = upsertEntry([], entry)
    expect(inserted).toEqual([entry])
    const updated = upsertEntry(inserted, { ...entry, label: 'Email 2' })
    expect(updated).toHaveLength(1)
    expect(updated[0]!.label).toBe('Email 2')
  })

  it('removeEntry drops by id and leaves others', () => {
    const other: VaultEntry = { ...entry, id: 'e2', label: 'Bank' }
    expect(removeEntry([entry, other], 'e1')).toEqual([other])
    expect(removeEntry([entry], 'missing')).toEqual([entry])
  })
})
