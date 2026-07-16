// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsProvider } from '../../state/SettingsProvider'
import { ToastProvider } from '../../state/useToasts'
import { VaultProvider, useVault } from '../../state/VaultProvider'
import { TEST_ITERATIONS } from '../../test/helpers'
import { VaultView } from './VaultView'

const writeText = vi.fn<(t: string) => Promise<void>>()
let api: ReturnType<typeof useVault>

function Probe() {
  api = useVault()
  return null
}

function setupUser() {
  const user = userEvent.setup()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return user
}

async function renderWithEntry(onShare?: (pw: string) => void) {
  render(
    <SettingsProvider>
      <VaultProvider iterations={TEST_ITERATIONS}>
        <ToastProvider>
          <VaultView onShare={onShare} />
          <Probe />
        </ToastProvider>
      </VaultProvider>
    </SettingsProvider>,
  )
  await screen.findByText(/create your vault/i)
  await act(() => api.createVault('a-long-master-pw'))
  await act(() => api.addEntry({ label: 'Mail', site: 'mail.io', username: 'max', password: 'Ent7y-S3cret!' }))
  await screen.findByText('Mail')
}

beforeEach(() => {
  localStorage.clear()
  writeText.mockReset().mockResolvedValue(undefined)
})

describe('EntryRow', () => {
  it('reveals the password and auto-hides it after 10 seconds', async () => {
    await renderWithEntry()
    expect(screen.queryByText('Ent7y-S3cret!')).toBeNull()

    // Fake timers must be active BEFORE the reveal registers its timeout.
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: /show password/i }))
      expect(screen.getByText('Ent7y-S3cret!')).toBeTruthy()
      act(() => vi.advanceTimersByTime(10_500))
      expect(screen.queryByText('Ent7y-S3cret!')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('copies the password and shows feedback', async () => {
    const user = setupUser()
    await renderWithEntry()
    await user.click(screen.getByRole('button', { name: /copy password/i }))
    expect(writeText).toHaveBeenCalledWith('Ent7y-S3cret!')
    expect(await screen.findByRole('button', { name: /^copied$/i })).toBeTruthy()
  })

  it('deletes only after confirmation', async () => {
    const user = setupUser()
    await renderWithEntry()
    await user.click(screen.getByRole('button', { name: /delete mail/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByText('Mail')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /delete mail/i }))
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await screen.findByText(/your vault is empty/i)
  })

  it('hands the password to onShare', async () => {
    const onShare = vi.fn()
    const user = setupUser()
    await renderWithEntry(onShare)
    await user.click(screen.getByRole('button', { name: /share mail/i }))
    expect(onShare).toHaveBeenCalledWith('Ent7y-S3cret!')
  })
})
