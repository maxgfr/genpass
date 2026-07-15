// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsProvider } from '../../state/SettingsProvider'
import { ToastProvider } from '../../state/useToasts'
import { VaultProvider } from '../../state/VaultProvider'
import { TEST_ITERATIONS } from '../../test/helpers'
import { VaultView } from './VaultView'

const writeText = vi.fn<(t: string) => Promise<void>>()

beforeEach(() => {
  localStorage.clear()
  writeText.mockReset().mockResolvedValue(undefined)
})

function setupUser() {
  const user = userEvent.setup()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return user
}

function renderVault() {
  return render(
    <SettingsProvider>
      <VaultProvider iterations={TEST_ITERATIONS}>
        <ToastProvider>
          <VaultView />
        </ToastProvider>
      </VaultProvider>
    </SettingsProvider>,
  )
}

async function createVault(user: ReturnType<typeof userEvent.setup>, password = 'a-long-master-pw') {
  await screen.findByText(/create your vault/i)
  await user.type(screen.getByLabelText(/^master password$/i), password)
  await user.type(screen.getByLabelText(/confirm master password/i), password)
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: /create vault/i }))
  await screen.findByText(/your vault is empty/i)
}

describe('VaultView', () => {
  it('walks first-run → create → empty state', async () => {
    const user = setupUser()
    renderVault()
    await createVault(user)
    expect(screen.getByText(/no saved passwords/i)).toBeTruthy()
  })

  it('blocks creation on mismatched confirmation', async () => {
    const user = setupUser()
    renderVault()
    await screen.findByText(/create your vault/i)
    await user.type(screen.getByLabelText(/^master password$/i), 'a-long-master-pw')
    await user.type(screen.getByLabelText(/confirm master password/i), 'different-pw-abc')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /create vault/i }))
    expect(await screen.findByText(/do not match/i)).toBeTruthy()
  })

  it('requires the acknowledgment checkbox', async () => {
    renderVault()
    await screen.findByText(/create your vault/i)
    expect((screen.getByRole('button', { name: /create vault/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('lock → unlock round trip, wrong password shows an error and stays locked', async () => {
    const user = setupUser()
    renderVault()
    await createVault(user)
    await user.click(screen.getByRole('button', { name: /^lock$/i }))
    await screen.findByText(/vault locked/i)

    await user.type(screen.getByLabelText(/^master password$/i), 'wrong-password!')
    await user.click(screen.getByRole('button', { name: /unlock/i }))
    expect(await screen.findByText(/wrong master password/i)).toBeTruthy()

    await user.type(screen.getByLabelText(/^master password$/i), 'a-long-master-pw')
    await user.click(screen.getByRole('button', { name: /unlock/i }))
    await screen.findByText(/your vault is empty/i)
  })
})
