// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createShareFragment, openShare, parseShareFragment } from '../../lib/share'
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

describe('ShareView — QR capacity guard', () => {
  it('shows a warning instead of crashing on text beyond QR capacity', async () => {
    render(
      <ToastProvider>
        <ShareView prefill={null} />
      </ToastProvider>,
    )
    const textarea = screen.getByLabelText(/^text$/i)
    fireEvent.change(textarea, { target: { value: 'x'.repeat(3000) } })
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText(/too long for a qr code/i)).toBeTruthy()
  })
})

describe('ShareView — downloads and copy', () => {
  it('downloads the QR as SVG and copies the created link', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:mock')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    const writeText = vi.fn(() => Promise.resolve())
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    render(
      <ToastProvider>
        <ShareView />
      </ToastProvider>,
    )
    await user.type(screen.getByLabelText(/^text$/i), 'download me')
    await user.click(screen.getByRole('button', { name: /download svg/i }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0]![0]
    expect(blob.type).toBe('image/svg+xml')
    expect(revokeObjectURL).toHaveBeenCalled()

    // Link mode: create then copy
    await user.click(screen.getByRole('radio', { name: /encrypted link/i }))
    await user.type(screen.getByLabelText(/^secret$/i), 'copy-me')
    await user.click(screen.getByRole('button', { name: /create encrypted link/i }))
    const link = (await screen.findByRole('textbox', { name: /share link/i })) as HTMLInputElement
    await user.click(screen.getByRole('button', { name: /copy link/i }))
    expect(writeText).toHaveBeenCalledWith(link.value)
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
    expect(screen.getByText(/no one-time view/i)).toBeTruthy()
    expect(screen.getByText(/until it expires/i)).toBeTruthy()
  })

  it('embeds the default 24-hour expiry in the encrypted payload', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ShareView prefill="MySecret!42" />
      </ToastProvider>,
    )
    const select = screen.getByLabelText(/link expires/i) as HTMLSelectElement
    expect(select.value).toBe('86400000')
    const before = Date.now()
    await user.click(screen.getByRole('button', { name: /create encrypted link/i }))
    const link = (await screen.findByRole('textbox', { name: /share link/i })) as HTMLInputElement
    const parsed = parseShareFragment(new URL(link.value).hash)!
    const payload = await openShare(parsed.envelope)
    expect(payload.exp).toBeGreaterThanOrEqual(before + 86_400_000)
    expect(payload.exp).toBeLessThanOrEqual(Date.now() + 86_400_000)
  })

  it('omits exp when expiry is set to Never', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ShareView prefill="MySecret!42" />
      </ToastProvider>,
    )
    await user.selectOptions(
      screen.getByLabelText(/link expires/i),
      screen.getByRole('option', { name: 'Never' }),
    )
    await user.click(screen.getByRole('button', { name: /create encrypted link/i }))
    const link = (await screen.findByRole('textbox', { name: /share link/i })) as HTMLInputElement
    const payload = await openShare(parseShareFragment(new URL(link.value).hash)!.envelope)
    expect(payload.exp).toBeUndefined()
  })

  it('blocks a passphrase shorter than 10 characters', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ShareView prefill="MySecret!42" />
      </ToastProvider>,
    )
    await user.type(screen.getByLabelText(/^passphrase/i), 'short')
    await user.click(screen.getByRole('button', { name: /create encrypted link/i }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Use at least 10 characters.')).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: /share link/i })).toBeNull()
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

  it('shows the expired state instead of the secret', async () => {
    const user = userEvent.setup()
    const fragment = await createShareFragment({ secret: 'gone-secret', exp: Date.now() - 1000 }, null)
    const parsed = parseShareFragment(fragment)!
    render(
      <ToastProvider>
        <ShareOpenDialog parsed={parsed} onClose={vi.fn()} />
      </ToastProvider>,
    )
    await user.click(screen.getByRole('button', { name: /reveal secret/i }))
    expect(await screen.findByText(/this link expired on/i)).toBeTruthy()
    expect(screen.queryByText('gone-secret')).toBeNull()
  })

  it('reports expiry, not a wrong passphrase, on an expired pass-mode link', async () => {
    const user = userEvent.setup()
    const fragment = await createShareFragment(
      { secret: 'gone-secret', exp: Date.now() - 1000 },
      'open sesame',
      TEST_ITERATIONS,
    )
    const parsed = parseShareFragment(fragment)!
    render(
      <ToastProvider>
        <ShareOpenDialog parsed={parsed} onClose={vi.fn()} />
      </ToastProvider>,
    )
    await user.type(screen.getByLabelText(/passphrase/i), 'open sesame')
    await user.click(screen.getByRole('button', { name: /reveal secret/i }))
    expect(await screen.findByText(/this link expired on/i)).toBeTruthy()
    expect(screen.queryByText(/wrong passphrase/i)).toBeNull()
  })
})
