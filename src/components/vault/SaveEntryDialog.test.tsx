// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsProvider } from '../../state/SettingsProvider'
import { ToastProvider } from '../../state/useToasts'
import { VaultProvider } from '../../state/VaultProvider'
import { TEST_ITERATIONS } from '../../test/helpers'
import { SaveEntryDialog } from './SaveEntryDialog'
import { VaultView } from './VaultView'

beforeEach(() => localStorage.clear())

function renderAll(password: string | null, onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <SettingsProvider>
        <VaultProvider iterations={TEST_ITERATIONS}>
          <ToastProvider>
            <VaultView />
            <SaveEntryDialog password={password} onClose={onClose} />
          </ToastProvider>
        </VaultProvider>
      </SettingsProvider>,
    ),
  }
}

describe('SaveEntryDialog', () => {
  it('embeds vault creation on first run, then saves the entry into the vault', async () => {
    const user = userEvent.setup()
    const { onClose } = renderAll('Gen3rated!Pw')

    // First run: the dialog walks through vault creation inline.
    const dialogs = await screen.findAllByText(/create your vault/i)
    expect(dialogs.length).toBeGreaterThan(0)
    const masterInputs = screen.getAllByLabelText(/^master password$/i)
    const confirmInputs = screen.getAllByLabelText(/confirm master password/i)
    // Type into the dialog's copy (the last one rendered).
    await user.type(masterInputs.at(-1)!, 'a-long-master-pw')
    await user.type(confirmInputs.at(-1)!, 'a-long-master-pw')
    await user.click(screen.getAllByRole('checkbox').at(-1)!)
    await user.click(screen.getAllByRole('button', { name: /create vault/i }).at(-1)!)

    // Now the save form appears.
    await user.type(await screen.findByLabelText(/^name$/i), 'GitHub')
    await user.type(screen.getByLabelText(/website/i), 'github.com')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText('GitHub')).toBeTruthy()
    expect(screen.getByText(/1 saved password/i)).toBeTruthy()
    expect(onClose).toHaveBeenCalled()
  })

  it('requires a name before saving', async () => {
    const user = userEvent.setup()
    renderAll('Gen3rated!Pw')
    const masterInputs = screen.getAllByLabelText(/^master password$/i)
    await user.type(masterInputs.at(-1)!, 'a-long-master-pw')
    await user.type(screen.getAllByLabelText(/confirm master password/i).at(-1)!, 'a-long-master-pw')
    await user.click(screen.getAllByRole('checkbox').at(-1)!)
    await user.click(screen.getAllByRole('button', { name: /create vault/i }).at(-1)!)
    await user.click(await screen.findByRole('button', { name: /^save$/i }))
    expect(await screen.findByText(/give this password a name/i)).toBeTruthy()
  })
})
