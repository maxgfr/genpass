// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SETTINGS_STORAGE_KEY } from '../../lib/settings'
import { sealVault } from '../../lib/vaultCrypto'
import { serializeVault } from '../../lib/vaultFormat'
import { VAULT_STORAGE_KEY } from '../../lib/vaultStorage'
import { SettingsProvider } from '../../state/SettingsProvider'
import { ToastProvider } from '../../state/useToasts'
import { VaultProvider } from '../../state/VaultProvider'
import { TEST_ITERATIONS } from '../../test/helpers'
import { GeneratorView } from '../generator/GeneratorView'
import { SettingsView } from './SettingsView'

beforeEach(() => localStorage.clear())

function renderSettings() {
  return render(
    <SettingsProvider>
      <VaultProvider iterations={TEST_ITERATIONS}>
        <ToastProvider>
          <SettingsView />
        </ToastProvider>
      </VaultProvider>
    </SettingsProvider>,
  )
}

describe('SettingsView', () => {
  it('persists the theme choice', async () => {
    const user = userEvent.setup()
    renderSettings()
    await user.click(screen.getByRole('radio', { name: /dark/i }))
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toMatchObject({ theme: 'dark' })
  })

  it('persists security settings', async () => {
    const user = userEvent.setup()
    renderSettings()
    await user.selectOptions(screen.getByLabelText(/auto-lock/i), '15')
    await user.selectOptions(screen.getByLabelText(/clear clipboard/i), '0')
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toMatchObject({
      autoLockMinutes: 15,
      clipboardClearSeconds: 0,
    })
  })

  it('persists default mode and batch size', async () => {
    const user = userEvent.setup()
    renderSettings()
    await user.click(screen.getByRole('radio', { name: /passphrase/i }))
    await user.click(screen.getByRole('radio', { name: /×10/i }))
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toMatchObject({
      generator: { mode: 'passphrase', batchSize: 10 },
    })
  })

  it('generator defaults persist and seed the next GeneratorView mount', async () => {
    const user = userEvent.setup()
    const { unmount } = renderSettings()
    fireEvent.change(screen.getByRole('slider', { name: /length/i }), { target: { value: '33' } })
    await user.click(screen.getByRole('switch', { name: /symbols/i })) // off
    await user.type(screen.getByLabelText(/exclude characters/i), 'zz9')
    unmount()

    render(
      <SettingsProvider>
        <ToastProvider>
          <GeneratorView />
        </ToastProvider>
      </SettingsProvider>,
    )
    const pw = screen.getByTestId('password').textContent!
    expect(pw).toHaveLength(33)
    expect(pw).not.toMatch(/[z9]/)
  })

  it('erase vault is disabled when no vault exists', async () => {
    renderSettings()
    const trigger = (await screen.findByRole('button', { name: 'Erase vault…' })) as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
  })

  it('erases the stored vault after explicit acknowledgment', async () => {
    const user = userEvent.setup()
    const file = await sealVault({ entries: [] }, 'a-master-pw', TEST_ITERATIONS)
    localStorage.setItem(VAULT_STORAGE_KEY, serializeVault(file))
    renderSettings()

    const trigger = (await screen.findByRole('button', { name: 'Erase vault…' })) as HTMLButtonElement
    expect(trigger.disabled).toBe(false)
    await user.click(trigger)

    const dialog = within(screen.getByRole('dialog'))
    const confirm = dialog.getByRole('button', { name: /erase vault forever/i }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    await user.click(dialog.getByRole('checkbox'))
    await user.click(confirm)

    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeNull()
    expect(await screen.findByText(/vault erased/i)).toBeTruthy()
  })
})
