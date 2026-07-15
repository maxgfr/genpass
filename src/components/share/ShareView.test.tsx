// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createShareFragment, parseShareFragment } from '../../lib/share'
import { ToastProvider } from '../../state/useToasts'
import { TEST_ITERATIONS } from '../../test/helpers'
import { ShareOpenDialog } from './ShareOpenDialog'
import { ShareView } from './ShareView'

beforeEach(() => localStorage.clear())

describe('ShareView — QR mode', () => {
  it('renders a QR code for typed text with download actions', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ShareView />
      </ToastProvider>,
    )
    await user.type(screen.getByLabelText(/^text$/i), 'https://example.com')
    expect(screen.getByRole('img', { name: /qr code/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /download svg/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /download png/i })).toBeTruthy()
  })
})

describe('ShareView — encrypted link mode', () => {
  it('creates a keyed link containing the fragment and shows its QR', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ShareView prefill="MySecret!42" />
      </ToastProvider>,
    )
    // Prefill lands in link mode with the secret filled in.
    expect((screen.getByLabelText(/^secret$/i) as HTMLTextAreaElement).value).toBe('MySecret!42')
    await user.click(screen.getByRole('button', { name: /create encrypted link/i }))
    const link = (await screen.findByRole('textbox', { name: /share link/i })) as HTMLInputElement
    expect(link.value).toContain('#s=')
    expect(screen.getByRole('img', { name: /share link/i })).toBeTruthy()
    expect(screen.getByText(/no expiry/i)).toBeTruthy()
  })
})

describe('ShareOpenDialog', () => {
  it('opens a keyed share and reveals the secret', async () => {
    const user = userEvent.setup()
    const fragment = await createShareFragment({ secret: 'shared-secret', label: 'Wi-Fi' }, null)
    const parsed = parseShareFragment(fragment)!
    render(
      <ToastProvider>
        <ShareOpenDialog parsed={parsed} onClose={vi.fn()} />
      </ToastProvider>,
    )
    await user.click(screen.getByRole('button', { name: /reveal secret/i }))
    expect(await screen.findByText('shared-secret')).toBeTruthy()
    expect(screen.getByText('Wi-Fi')).toBeTruthy()
  })

  it('requires the passphrase, rejects a wrong one, accepts the right one', async () => {
    const user = userEvent.setup()
    const fragment = await createShareFragment({ secret: 'hidden' }, 'sesame', TEST_ITERATIONS)
    const parsed = parseShareFragment(fragment)!
    render(
      <ToastProvider>
        <ShareOpenDialog parsed={parsed} onClose={vi.fn()} />
      </ToastProvider>,
    )
    await user.type(screen.getByLabelText(/passphrase/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /reveal secret/i }))
    expect(await screen.findByText(/wrong passphrase/i)).toBeTruthy()

    await user.type(screen.getByLabelText(/passphrase/i), 'sesame')
    await user.click(screen.getByRole('button', { name: /reveal secret/i }))
    expect(await screen.findByText('hidden')).toBeTruthy()
  })
})
