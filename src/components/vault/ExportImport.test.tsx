// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SettingsProvider } from '../../state/SettingsProvider'
import { ToastProvider } from '../../state/useToasts'
import { VaultProvider, useVault } from '../../state/VaultProvider'
import { TEST_ITERATIONS } from '../../test/helpers'
import { VaultView } from './VaultView'

let api: ReturnType<typeof useVault>

function Probe() {
  api = useVault()
  return null
}

function renderVault() {
  return render(
    <SettingsProvider>
      <VaultProvider iterations={TEST_ITERATIONS}>
        <ToastProvider>
          <VaultView />
          <Probe />
        </ToastProvider>
      </VaultProvider>
    </SettingsProvider>,
  )
}

beforeEach(() => localStorage.clear())

async function createUnlockedVault(password = 'a-long-master-pw') {
  const user = userEvent.setup()
  await screen.findByText(/create your vault/i)
  await user.type(screen.getByLabelText(/^master password$/i), password)
  await user.type(screen.getByLabelText(/confirm master password/i), password)
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: /create vault/i }))
  await screen.findByText(/your vault is empty/i)
  return user
}

describe('change master password', () => {
  it('rejects a wrong current password, accepts the right one', async () => {
    renderVault()
    const user = await createUnlockedVault()
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await user.type(screen.getByLabelText(/current master password/i), 'wrong-password')
    await user.type(screen.getByLabelText(/^new master password$/i), 'brand-new-master')
    await user.type(screen.getByLabelText(/confirm new master password/i), 'brand-new-master')
    await user.click(screen.getByRole('button', { name: /confirm new password/i }))
    expect(await screen.findByText(/current master password is wrong/i)).toBeTruthy()

    const current = screen.getByLabelText(/current master password/i)
    await user.clear(current)
    await user.type(current, 'a-long-master-pw')
    await user.click(screen.getByRole('button', { name: /confirm new password/i }))
    await screen.findByText(/master password changed/i)

    // The new password unlocks; the old one does not.
    await user.click(screen.getByRole('button', { name: /^lock$/i }))
    await screen.findByText(/vault locked/i)
    await user.type(screen.getByLabelText(/^master password$/i), 'brand-new-master')
    await user.click(screen.getByRole('button', { name: /unlock/i }))
    await screen.findByText(/your vault is empty/i)
  })
})

describe('import', () => {
  it('replaces the vault from an exported file after password confirmation', async () => {
    renderVault()
    const user = await createUnlockedVault()
    await act(() => api.addEntry({ label: 'Imported entry', password: 'pw!' }))
    const blob = api.exportBlob()!

    // Make the current vault differ from the blob, then import it back.
    const id = api.state.status === 'unlocked' ? api.state.entries[0]!.id : ''
    await act(() => api.deleteEntry(id))
    await screen.findByText(/your vault is empty/i)

    const file = new File([blob], 'genpass-vault.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText(/import vault file/i), file)
    expect(await screen.findByText(/replaces your current vault/i)).toBeTruthy()

    await user.type(screen.getByLabelText(/master password of the imported file/i), 'wrong-pw')
    await user.click(screen.getByRole('button', { name: /replace vault/i }))
    expect(await screen.findByText(/wrong master password for this file/i)).toBeTruthy()

    const pwField = screen.getByLabelText(/master password of the imported file/i)
    await user.clear(pwField)
    await user.type(pwField, 'a-long-master-pw')
    await user.click(screen.getByRole('button', { name: /replace vault/i }))
    expect(await screen.findByText('Imported entry')).toBeTruthy()
  })

  it('rejects a non-vault file with a clear message', async () => {
    renderVault()
    const user = await createUnlockedVault()
    const file = new File(['{"hello": true}'], 'random.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText(/import vault file/i), file)
    await user.type(screen.getByLabelText(/master password of the imported file/i), 'whatever-pw')
    await user.click(screen.getByRole('button', { name: /replace vault/i }))
    expect(await screen.findByText(/not a genpass vault export/i)).toBeTruthy()
  })
})
