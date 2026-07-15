// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { VAULT_STORAGE_KEY } from '../lib/vaultStorage'
import { parseVaultFile } from '../lib/vaultFormat'
import { VaultDecryptError } from '../lib/vaultCrypto'
import { TEST_ITERATIONS } from '../test/helpers'
import { VaultProvider, useVault } from './VaultProvider'

let api: ReturnType<typeof useVault>

function Probe() {
  api = useVault()
  return <span data-testid="status">{api.state.status}</span>
}

function renderVault() {
  return render(
    <VaultProvider iterations={TEST_ITERATIONS}>
      <Probe />
    </VaultProvider>,
  )
}

async function status(expected: string) {
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe(expected))
}

beforeEach(() => localStorage.clear())

describe('VaultProvider', () => {
  it('initializes to uninitialized on first run', async () => {
    renderVault()
    await status('uninitialized')
  })

  it('create → add → the stored blob is valid and contains no plaintext', async () => {
    renderVault()
    await status('uninitialized')
    await act(() => api.createVault('master-pw'))
    await status('unlocked')
    await act(() => api.addEntry({ label: 'Email', password: 'Sup3rS3cret!' }))
    const raw = localStorage.getItem(VAULT_STORAGE_KEY)!
    expect(raw).not.toContain('Sup3rS3cret!')
    expect(raw).not.toContain('master-pw')
    expect(raw).not.toContain('Email')
    expect(parseVaultFile(raw).iterations).toBe(TEST_ITERATIONS)
  })

  it('lock drops entries; unlock with the right password restores them', async () => {
    renderVault()
    await status('uninitialized')
    await act(() => api.createVault('master-pw'))
    await act(() => api.addEntry({ label: 'Email', password: 'pw1' }))
    act(() => api.lock())
    await status('locked')
    await act(() => api.unlock('master-pw'))
    await status('unlocked')
    expect(api.state.status === 'unlocked' && api.state.entries[0]!.label).toBe('Email')
  })

  it('unlock with a wrong password rejects and stays locked', async () => {
    renderVault()
    await status('uninitialized')
    await act(() => api.createVault('master-pw'))
    act(() => api.lock())
    await expect(act(() => api.unlock('nope'))).rejects.toBeInstanceOf(VaultDecryptError)
    await status('locked')
  })

  it('a reload (remount) finds the persisted vault locked', async () => {
    const { unmount } = renderVault()
    await status('uninitialized')
    await act(() => api.createVault('master-pw'))
    unmount()
    renderVault()
    await status('locked')
  })

  it('update and delete persist', async () => {
    renderVault()
    await status('uninitialized')
    await act(() => api.createVault('pw'))
    await act(() => api.addEntry({ label: 'A', password: '1' }))
    const id = api.state.status === 'unlocked' ? api.state.entries[0]!.id : ''
    await act(() =>
      api.updateEntry({
        ...(api.state.status === 'unlocked' ? api.state.entries[0]! : (null as never)),
        label: 'B',
      }),
    )
    expect(api.state.status === 'unlocked' && api.state.entries[0]!.label).toBe('B')
    await act(() => api.deleteEntry(id))
    expect(api.state.status === 'unlocked' && api.state.entries).toEqual([])
  })

  it('changeMasterPassword requires the current password and re-encrypts', async () => {
    renderVault()
    await status('uninitialized')
    await act(() => api.createVault('old-pw'))
    await act(() => api.addEntry({ label: 'A', password: '1' }))
    await expect(act(() => api.changeMasterPassword('wrong', 'new-pw'))).rejects.toBeInstanceOf(
      VaultDecryptError,
    )
    await act(() => api.changeMasterPassword('old-pw', 'new-pw'))
    act(() => api.lock())
    await expect(act(() => api.unlock('old-pw'))).rejects.toBeInstanceOf(VaultDecryptError)
    await act(() => api.unlock('new-pw'))
    await status('unlocked')
    expect(api.state.status === 'unlocked' && api.state.entries[0]!.label).toBe('A')
  })

  it('export → import round-trips into a fresh vault (replace)', async () => {
    const first = renderVault()
    await status('uninitialized')
    await act(() => api.createVault('pw-a'))
    await act(() => api.addEntry({ label: 'Roundtrip', password: 's3cret' }))
    const blob = api.exportBlob()!
    first.unmount()
    localStorage.clear()

    renderVault()
    await status('uninitialized')
    await act(() => api.importReplace(blob, 'pw-a'))
    await status('unlocked')
    expect(api.state.status === 'unlocked' && api.state.entries[0]!.label).toBe('Roundtrip')
    // Imported blob is now the persisted vault.
    expect(parseVaultFile(localStorage.getItem(VAULT_STORAGE_KEY)!)).toEqual(parseVaultFile(blob))
  })

  it('import with a wrong password leaves the existing vault untouched', async () => {
    renderVault()
    await status('uninitialized')
    await act(() => api.createVault('pw-a'))
    const blob = api.exportBlob()!
    await expect(act(() => api.importReplace(blob, 'wrong'))).rejects.toBeInstanceOf(VaultDecryptError)
    await status('unlocked')
  })
})
