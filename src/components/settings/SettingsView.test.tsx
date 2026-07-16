// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SETTINGS_STORAGE_KEY } from '../../lib/settings'
import { SettingsProvider } from '../../state/SettingsProvider'
import { ToastProvider } from '../../state/useToasts'
import { GeneratorView } from '../generator/GeneratorView'
import { SettingsView } from './SettingsView'

beforeEach(() => localStorage.clear())

function renderSettings() {
  return render(
    <SettingsProvider>
      <ToastProvider>
        <SettingsView />
      </ToastProvider>
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
})
