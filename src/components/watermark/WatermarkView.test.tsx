// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installCanvasMock, type CanvasMock } from '../../test/helpers'
import { WatermarkView } from './WatermarkView'

// Neither library is loadable in jsdom (pdf-lib is fine in Node but slow here,
// heic-to needs a real Worker), and neither is what these tests are about.
vi.mock('../../lib/pdfWatermark', async () => {
  const actual = await vi.importActual<typeof import('../../lib/pdfWatermark')>(
    '../../lib/pdfWatermark',
  )
  return {
    ...actual,
    watermarkPdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
    imageToPdf: vi.fn(async () => new Uint8Array([4, 5, 6])),
    readPdfInfo: vi.fn(async () => ({ pageCount: 3, first: { width: 595, height: 842 } })),
  }
})

// pdf.js needs a real worker and real canvas rendering; neither exists here.
vi.mock('../../lib/pdfPreview', () => ({
  renderPdfPage: vi.fn(async () => ({
    bitmap: { width: 595, height: 842, close: () => {} },
    width: 595,
    height: 842,
  })),
  PdfPreviewError: class extends Error {},
}))

vi.mock('../../lib/heic', () => ({
  decodeHeic: vi.fn(async () => ({ width: 400, height: 300, close: () => {} })),
  HeicDecodeError: class extends Error {},
  HeicUnavailableError: class extends Error {},
}))

let canvas: CanvasMock

beforeEach(() => {
  canvas = installCanvasMock()
})

afterEach(() => {
  canvas.restore()
  vi.clearAllMocks()
})

function bytes(...values: (number | string)[]): Uint8Array {
  const out: number[] = []
  for (const value of values) {
    if (typeof value === 'number') out.push(value)
    else for (const ch of value) out.push(ch.charCodeAt(0))
  }
  return new Uint8Array(out)
}

const PNG_BYTES = bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13)
const JPEG_BYTES = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16, 'JFIF')
const PDF_BYTES = bytes('%PDF-1.7\n%')

function pngFile(name = 'photo.png'): File {
  return new File([PNG_BYTES as BlobPart], name, { type: 'image/png' })
}

function jpegFile(name = 'scan.jpg'): File {
  return new File([JPEG_BYTES as BlobPart], name, { type: 'image/jpeg' })
}

function pdfFile(name = 'report.pdf'): File {
  return new File([PDF_BYTES as BlobPart], name, { type: 'application/pdf' })
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText(/add documents to watermark/i)
}

/**
 * applyAccept: false — the input's `accept` is a picker convenience, and the
 * app deliberately classifies by magic bytes instead. Letting userEvent enforce
 * `accept` would silently drop the very file the rejection path is about.
 */
function setupUser() {
  return userEvent.setup({ applyAccept: false })
}

async function add(user: ReturnType<typeof userEvent.setup>, ...files: File[]) {
  await user.upload(fileInput(), files)
}

describe('WatermarkView — the queue', () => {
  it('starts empty, with the drop target explaining what it takes', () => {
    render(<WatermarkView />)
    expect(screen.getByRole('button', { name: /choose documents/i })).toBeTruthy()
    expect(screen.getByText(/PDF, PNG, JPEG, WebP and HEIC/i)).toBeTruthy()
    // Nothing to act on yet, so no queue actions.
    expect(screen.queryByRole('button', { name: /apply watermark/i })).toBeNull()
  })

  it('keeps the drop target and the queue in one place', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pngFile())
    await screen.findByText('photo.png')

    // The user should not have to scroll past the settings and the preview to
    // reach the files they just dropped: same panel, drop target first.
    const panel = screen
      .getByRole('button', { name: /choose documents/i })
      .closest('.panel') as HTMLElement
    expect(within(panel).getByText('photo.png')).toBeTruthy()
    expect(within(panel).getByRole('button', { name: /apply watermark/i })).toBeTruthy()
  })

  it('lists dropped files with their size and status', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pngFile(), jpegFile())

    await screen.findByText('photo.png')
    expect(screen.getByText('scan.jpg')).toBeTruthy()
    expect(screen.getAllByText(/ready to watermark/i)).toHaveLength(2)
  })

  it('announces additions once, in a single live region', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pngFile(), jpegFile())

    const regions = screen.getAllByRole('status')
    const queueStatus = regions.find((node) => /documents added/i.test(node.textContent ?? ''))
    expect(queueStatus?.textContent).toMatch(/2 documents added/i)
  })

  it('rejects an unsupported file without breaking the others', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pngFile(), new File([bytes('plain text')] as BlobPart[], 'notes.txt'))

    const failure = await screen.findByRole('alert')
    expect(failure.textContent).toMatch(/not a supported document/i)
    // The good file is still queued and still actionable.
    expect(screen.getByText('photo.png')).toBeTruthy()
    expect(screen.getByRole('button', { name: /apply watermark/i }).hasAttribute('disabled')).toBe(
      false,
    )
  })

  it('removes a single file without touching the rest', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pngFile(), jpegFile())
    await screen.findByText('photo.png')

    await user.click(screen.getByRole('button', { name: /remove photo\.png/i }))
    await waitFor(() => expect(screen.queryByText('photo.png')).toBeNull())
    expect(screen.getByText('scan.jpg')).toBeTruthy()
  })
})

describe('WatermarkView — processing', () => {
  it('runs the queue and offers a download only once a file is done', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pngFile())
    await screen.findByText('photo.png')

    expect(screen.queryByRole('button', { name: /^download$/i })).toBeNull()
    await user.click(screen.getByRole('button', { name: /apply watermark/i }))

    const row = screen.getByText('photo.png').closest('li')!
    await waitFor(() => expect(within(row).getByText(/· Watermarked/)).toBeTruthy())
    expect(within(row).getByRole('button', { name: /^download$/i })).toBeTruthy()
  })

  it('offers a ZIP only once two files are finished', async () => {
    const user = setupUser()
    render(<WatermarkView />)

    await add(user, pngFile())
    await screen.findByText('photo.png')
    await user.click(screen.getByRole('button', { name: /apply watermark/i }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^download$/i })).toHaveLength(1))
    expect(screen.queryByRole('button', { name: /download all/i })).toBeNull()

    await add(user, jpegFile())
    await user.click(screen.getByRole('button', { name: /apply watermark/i }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^download$/i })).toHaveLength(2))
    expect(screen.getByRole('button', { name: /download all/i })).toBeTruthy()
  })

  it('re-queues finished work when the watermark changes, so no stale file is offered', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pngFile())
    await screen.findByText('photo.png')
    await user.click(screen.getByRole('button', { name: /apply watermark/i }))
    await screen.findByRole('button', { name: /^download$/i })

    await user.clear(screen.getByLabelText(/watermark text/i))
    await user.type(screen.getByLabelText(/watermark text/i), 'DRAFT')

    await waitFor(() => expect(screen.queryByRole('button', { name: /^download$/i })).toBeNull())
    expect(screen.getByText(/ready to watermark/i)).toBeTruthy()
  })

  it('reports one file failing without stopping the batch', async () => {
    const { watermarkPdf } = await import('../../lib/pdfWatermark')
    vi.mocked(watermarkPdf).mockRejectedValueOnce(new Error('This PDF is password-protected.'))

    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pdfFile(), pngFile())
    await screen.findByText('report.pdf')

    await user.click(screen.getByRole('button', { name: /apply watermark/i }))

    await screen.findByText(/this pdf is password-protected/i)
    // The other file still went through.
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^download$/i })).toHaveLength(1))
  })
})

describe('WatermarkView — options', () => {
  it('redraws the preview when the text changes', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pngFile())
    await waitFor(() => expect(canvas.fillTextCalls().length).toBeGreaterThan(0))

    await user.clear(screen.getByLabelText(/watermark text/i))
    await user.type(screen.getByLabelText(/watermark text/i), 'DRAFT')

    await waitFor(() =>
      expect(canvas.fillTextCalls().some((call) => call.text === 'DRAFT')).toBe(true),
    )
  })

  it('describes the current settings in words for a screen reader', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pngFile())

    const preview = await screen.findByRole('img')
    expect(preview.getAttribute('aria-label')).toMatch(/tiled watermark reading .CONFIDENTIAL./i)
    expect(preview.getAttribute('aria-label')).toMatch(/rotated 45 degrees/i)
  })

  it('warns before processing when the text cannot be drawn into a PDF', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pdfFile())
    await screen.findByText('report.pdf')

    expect(screen.queryByText(/cannot draw these characters/i)).toBeNull()
    await user.clear(screen.getByLabelText(/watermark text/i))
    await user.type(screen.getByLabelText(/watermark text/i), '社外秘')

    expect(await screen.findByText(/cannot draw these characters/i)).toBeTruthy()
  })

  it('offers a PDF no image output — there is no rasteriser', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pdfFile())
    await screen.findByText('report.pdf')

    // A PDF's only option is PDF, so the row shows no format picker at all.
    const row = screen.getByText('report.pdf').closest('li')!
    expect(within(row).queryByLabelText(/save as/i)).toBeNull()
  })

  it('lets an image be saved as a PDF', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pngFile())
    await screen.findByText('photo.png')

    const select = screen.getByLabelText(/save as/i) as HTMLSelectElement
    expect([...select.options].map((option) => option.value)).toEqual(['png', 'jpeg', 'webp', 'pdf'])
    expect(select.value).toBe('png')
  })

  it('previews a file that works rather than parking on one that failed', async () => {
    const { watermarkPdf } = await import('../../lib/pdfWatermark')
    vi.mocked(watermarkPdf).mockRejectedValueOnce(new Error('This PDF is password-protected.'))

    const user = setupUser()
    render(<WatermarkView />)
    // The failing file is first in the queue, so it would be the default.
    await add(user, pdfFile(), pngFile())
    await screen.findByText('report.pdf')
    await user.click(screen.getByRole('button', { name: /apply watermark/i }))
    await screen.findByText(/password-protected/i)

    await waitFor(() =>
      expect((screen.getByRole('radio', { name: /photo\.png/ }) as HTMLInputElement).checked).toBe(
        true,
      ),
    )
  })

  it('lets the user pick which document the preview shows', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pngFile(), jpegFile())
    await screen.findByText('photo.png')

    const first = screen.getByRole('radio', { name: /photo\.png/ }) as HTMLInputElement
    const second = screen.getByRole('radio', { name: /scan\.jpg/ }) as HTMLInputElement
    expect(first.checked).toBe(true)

    await user.click(second)
    await waitFor(() => expect(second.checked).toBe(true))
    expect(first.checked).toBe(false)
    expect(
      screen.getByRole('img').getAttribute('aria-label'),
      'the preview follows the selection',
    ).toContain('scan.jpg')
  })

  it('groups the preview radios so arrow keys move between documents', async () => {
    const user = setupUser()
    render(<WatermarkView />)
    await add(user, pngFile(), jpegFile())
    await screen.findByText('photo.png')

    expect(screen.getByRole('radiogroup', { name: /document to preview/i })).toBeTruthy()
  })

  it('says plainly that a watermark is not protection', () => {
    render(<WatermarkView />)
    expect(screen.getByText(/not protection/i)).toBeTruthy()
  })
})
