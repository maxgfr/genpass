// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CLASS_CHARS } from '../../lib/charset'
import { SettingsProvider } from '../../state/SettingsProvider'
import { ToastProvider } from '../../state/useToasts'
import { GeneratorView } from './GeneratorView'

const writeText = vi.fn<(t: string) => Promise<void>>()

beforeEach(() => {
  localStorage.clear()
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

/** userEvent.setup() replaces navigator.clipboard with its own stub —
 *  re-install our spy afterwards so assertions see real calls. */
function setupUser() {
  const user = userEvent.setup()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return user
}

function renderView(onSave?: (password: string) => void) {
  return render(
    <SettingsProvider>
      <ToastProvider>
        <GeneratorView onSave={onSave} />
      </ToastProvider>
    </SettingsProvider>,
  )
}

function passwords(): string[] {
  return screen.getAllByTestId('password').map((el) => el.textContent ?? '')
}

describe('GeneratorView — character mode', () => {
  it('renders one 20-char password by default', () => {
    renderView()
    const [pw] = passwords()
    expect(passwords()).toHaveLength(1)
    expect(pw).toHaveLength(20)
  })

  it('regenerates without digits when the Digits class is toggled off', async () => {
    const user = setupUser()
    renderView()
    await user.click(screen.getByRole('switch', { name: /digits/i }))
    for (const ch of passwords()[0]!) {
      expect(CLASS_CHARS.digits).not.toContain(ch)
    }
  })

  it('changes length via the slider', () => {
    renderView()
    fireEvent.change(screen.getByRole('slider', { name: /length/i }), { target: { value: '32' } })
    expect(passwords()[0]).toHaveLength(32)
  })

  it('generates a batch of 10, each with its own copy button', async () => {
    const user = setupUser()
    renderView()
    await user.click(screen.getByRole('radio', { name: /10/ }))
    expect(passwords()).toHaveLength(10)
    expect(new Set(passwords()).size).toBe(10)
    expect(screen.getAllByRole('button', { name: /^copy$/i })).toHaveLength(10)
  })

  it('copies to the clipboard and confirms', async () => {
    const user = setupUser()
    renderView()
    const pw = passwords()[0]!
    await user.click(screen.getByRole('button', { name: /^copy$/i }))
    expect(writeText).toHaveBeenCalledWith(pw)
    await waitFor(() => expect(screen.getByRole('button', { name: /copied/i })).toBeTruthy())
  })

  it('never emits custom-excluded characters and warns when a class empties', async () => {
    const user = setupUser()
    renderView()
    await user.type(screen.getByLabelText(/exclude characters/i), '0123456789')
    expect(screen.getByText(/fully excluded/i).textContent).toMatch(/digits/i)
    for (const ch of passwords()[0]!) expect('0123456789').not.toContain(ch)
  })

  it('disables generation with a clear message when no class is selected', async () => {
    const user = setupUser()
    renderView()
    for (const name of [/uppercase/i, /lowercase/i, /digits/i, /symbols/i]) {
      await user.click(screen.getByRole('switch', { name }))
    }
    expect(screen.queryAllByTestId('password')).toHaveLength(0)
    expect(screen.getByText(/select at least one/i)).toBeTruthy()
  })

  it('offers save-to-vault per result when wired', async () => {
    const onSave = vi.fn()
    const user = setupUser()
    renderView(onSave)
    const pw = passwords()[0]!
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(pw)
  })
})

describe('GeneratorView — passphrase mode', () => {
  it('generates capitalized hyphen-separated words by default', async () => {
    const user = setupUser()
    renderView()
    await user.click(screen.getByRole('radio', { name: /passphrase/i }))
    const words = passwords()[0]!.split('-')
    expect(words).toHaveLength(5)
    for (const w of words) expect(w).toMatch(/^[A-Z][a-z-]*$/)
  })

  it('separator and digit options apply', async () => {
    const user = setupUser()
    renderView()
    await user.click(screen.getByRole('radio', { name: /passphrase/i }))
    await user.selectOptions(screen.getByLabelText(/separator/i), '.')
    await user.click(screen.getByRole('switch', { name: /add a digit/i }))
    const phrase = passwords()[0]!
    expect(phrase.split('.')).toHaveLength(5)
    expect(phrase.match(/\d/g)).toHaveLength(1)
  })

  it('word count follows the slider', async () => {
    const user = setupUser()
    renderView()
    await user.click(screen.getByRole('radio', { name: /passphrase/i }))
    fireEvent.change(screen.getByRole('slider', { name: /words/i }), { target: { value: '8' } })
    expect(passwords()[0]!.split('-')).toHaveLength(8)
  })
})
