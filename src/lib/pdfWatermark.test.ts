import { describe, expect, it } from 'vitest'
import { PDFDocument, PDFRawStream, StandardFonts, decodePDFRawStream, degrees } from 'pdf-lib'
import { DEFAULT_WATERMARK, type WatermarkConfig } from './watermark'
import {
  BrokenPdfError,
  ProtectedPdfError,
  imageToPdf,
  isWinAnsiEncodable,
  readPdfInfo,
  unrotatePoint,
  watermarkPdf,
} from './pdfWatermark'

function config(overrides: Partial<WatermarkConfig> = {}): WatermarkConfig {
  return { ...DEFAULT_WATERMARK, ...overrides }
}

/** A two-page document with real text on it, built the way a user's would be. */
async function samplePdf(rotate = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false })
  doc.setProducer('Some Other Tool')
  doc.setTitle('Quarterly report')
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const label of ['Page one body text', 'Page two body text']) {
    const page = doc.addPage([595, 842])
    if (rotate) page.setRotation(degrees(rotate))
    page.drawText(label, { x: 72, y: 700, size: 12, font })
  }
  return doc.save()
}

/**
 * pdf-lib shows text as a hex string (`<445241465420434F5059> Tj`), so the
 * words are only readable once those are turned back into characters.
 */
function decodeShownText(stream: string): string {
  return stream.replace(/<([0-9A-Fa-f]+)>/g, (whole, hex: string) => {
    if (hex.length % 2 !== 0) return whole
    const pairs = hex.match(/../g) ?? []
    return pairs.map((pair) => String.fromCharCode(Number.parseInt(pair, 16))).join('')
  })
}

/**
 * Everything a PDF's page content streams say, per page.
 * Content streams are Flate-compressed, so they have to be decoded before any
 * assertion about drawn text means anything.
 */
async function pageContents(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes)
  const decoder = new TextDecoder('latin1')
  return doc.getPages().map((page) =>
    (page.node.normalizedEntries().Contents?.asArray() ?? [])
      // A loaded page's Contents array holds the real stream plus the `q`/`Q`
      // guards pdf-lib wraps around it; only the raw one carries bytes.
      .map((ref) => doc.context.lookup(ref))
      .filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream)
      .map((stream) => decodeShownText(decoder.decode(decodePDFRawStream(stream).decode())))
      .join('\n'),
  )
}

/** Every page's content stream, concatenated. */
async function contentOf(bytes: Uint8Array): Promise<string> {
  return (await pageContents(bytes)).join('\n')
}

describe('watermarkPdf', () => {
  it('preserves the page count and every page size', async () => {
    const source = await samplePdf()
    const out = await watermarkPdf(source, config())

    const before = await PDFDocument.load(source)
    const after = await PDFDocument.load(out)
    expect(after.getPageCount()).toBe(before.getPageCount())
    for (let i = 0; i < after.getPageCount(); i++) {
      expect(after.getPage(i).getSize()).toEqual(before.getPage(i).getSize())
    }
  })

  it('draws the watermark text on every page', async () => {
    const out = await watermarkPdf(await samplePdf(), config({ text: 'DRAFT COPY' }))
    const pages = await pageContents(out)
    expect(pages).toHaveLength(2)
    for (const page of pages) {
      expect(page).toContain('DRAFT COPY')
    }
  })

  it("leaves the document's own text in place", async () => {
    const out = await watermarkPdf(await samplePdf(), config())
    const content = await contentOf(out)
    expect(content).toContain('Page one body text')
    expect(content).toContain('Page two body text')
  })

  it('writes vector text, not a raster overlay — the file stays small', async () => {
    const source = await samplePdf()
    const out = await watermarkPdf(source, config())
    expect(out.length).toBeLessThan(source.length + 20_000)
  })

  it('does not rewrite the document metadata', async () => {
    const source = await samplePdf()
    expect((await PDFDocument.load(source, { updateMetadata: false })).getProducer()).toBe('Some Other Tool')

    const doc = await PDFDocument.load(await watermarkPdf(source, config()), { updateMetadata: false })
    expect(doc.getProducer()).toBe('Some Other Tool')
    expect(doc.getTitle()).toBe('Quarterly report')
  })

  it('draws one stamp per page for the single layout, and many when tiled', async () => {
    const single = await contentOf(await watermarkPdf(await samplePdf(), config({ layout: 'single' })))
    const tiled = await contentOf(await watermarkPdf(await samplePdf(), config({ layout: 'tiled' })))
    const count = (haystack: string) => haystack.split('CONFIDENTIAL').length - 1
    expect(count(single)).toBe(2) // one per page
    expect(count(tiled)).toBeGreaterThan(10)
  })

  it('leaves the document untouched when the text is blank', async () => {
    const out = await watermarkPdf(await samplePdf(), config({ text: '  ' }))
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(2)
    expect(await contentOf(out)).not.toContain('CONFIDENTIAL')
  })

  it('handles a page carrying /Rotate without losing the watermark', async () => {
    for (const rotation of [90, 180, 270]) {
      const out = await watermarkPdf(await samplePdf(rotation), config())
      const doc = await PDFDocument.load(out)
      expect(doc.getPage(0).getRotation().angle).toBe(rotation)
      expect(await contentOf(out)).toContain('CONFIDENTIAL')
    }
  })

  it('reports a password-protected PDF as such, not as a generic failure', async () => {
    // pdf-lib refuses any document carrying /Encrypt in its trailer.
    const doc = await PDFDocument.create({ updateMetadata: false })
    doc.addPage([200, 200])
    // A classic trailer (no cross-reference stream) so /Encrypt can be added.
    // It has to be an inline dictionary: a reference to a missing object would
    // resolve to nothing and pdf-lib would see an unencrypted file.
    const bytes = await doc.save({ useObjectStreams: false })
    const text = new TextDecoder('latin1').decode(bytes)
    const encrypted = text.replace(
      'trailer\n<<',
      'trailer\n<<\n/Encrypt << /Filter /Standard /V 1 /R 2 /P -1 >>',
    )
    expect(encrypted).not.toBe(text)
    const patched = Uint8Array.from([...encrypted].map((ch) => ch.charCodeAt(0) & 0xff))

    await expect(watermarkPdf(patched, config())).rejects.toBeInstanceOf(ProtectedPdfError)
  })

  it('reports an unreadable file as damaged', async () => {
    const junk = new TextEncoder().encode('%PDF-1.7\nthis is not a pdf at all')
    await expect(watermarkPdf(junk, config())).rejects.toBeInstanceOf(BrokenPdfError)
  })
})

describe('readPdfInfo', () => {
  it('reports the page count and page 1 size', async () => {
    await expect(readPdfInfo(await samplePdf())).resolves.toEqual({
      pageCount: 2,
      first: { width: 595, height: 842 },
    })
  })

  it('reports the size the reader shows for a quarter-turned page', async () => {
    const info = await readPdfInfo(await samplePdf(90))
    expect(info.first).toEqual({ width: 842, height: 595 })
  })

  it('leaves a half-turned page in portrait', async () => {
    const info = await readPdfInfo(await samplePdf(180))
    expect(info.first).toEqual({ width: 595, height: 842 })
  })
})

describe('unrotatePoint', () => {
  const visible = { width: 400, height: 800 }

  it('flips only the y axis on an unrotated page', () => {
    expect(unrotatePoint(0, 0, visible, 0)).toEqual({ x: 0, y: 800 })
    expect(unrotatePoint(400, 800, visible, 0)).toEqual({ x: 400, y: 0 })
  })

  it('maps the four display corners onto four distinct user-space points, at every rotation', () => {
    for (const rotation of [0, 90, 180, 270]) {
      const corners = [
        [0, 0],
        [visible.width, 0],
        [0, visible.height],
        [visible.width, visible.height],
      ].map(([x, y]) => unrotatePoint(x!, y!, visible, rotation))
      expect(new Set(corners.map((p) => `${p.x},${p.y}`)).size).toBe(4)
    }
  })

  it('sends the display centre to the page centre, at every rotation', () => {
    const cx = visible.width / 2
    const cy = visible.height / 2
    expect(unrotatePoint(cx, cy, visible, 0)).toEqual({ x: cx, y: cy })
    expect(unrotatePoint(cx, cy, visible, 180)).toEqual({ x: cx, y: cy })
    // A quarter turn swaps the axes, so the page centre swaps with it.
    expect(unrotatePoint(cx, cy, visible, 90)).toEqual({ x: cy, y: cx })
    expect(unrotatePoint(cx, cy, visible, 270)).toEqual({ x: cy, y: cx })
  })

  it('normalises rotations outside 0–359', () => {
    expect(unrotatePoint(10, 20, visible, 450)).toEqual(unrotatePoint(10, 20, visible, 90))
    expect(unrotatePoint(10, 20, visible, -90)).toEqual(unrotatePoint(10, 20, visible, 270))
  })
})

describe('imageToPdf', () => {
  it('wraps a PNG in a one-page PDF sized to the image', async () => {
    // A 2×1 PNG, hand-built so the test carries no fixture file.
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8z8Dwn4GBgYEBAA8CAv+2VJHhAAAAAElFTkSuQmCC',
      ),
      (ch) => ch.charCodeAt(0),
    )
    const doc = await PDFDocument.load(await imageToPdf(png, 'png'))
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getPage(0).getSize()).toEqual({ width: 2, height: 1 })
  })
})

describe('isWinAnsiEncodable', () => {
  it('accepts what the built-in Helvetica can actually render', () => {
    expect(isWinAnsiEncodable('CONFIDENTIAL')).toBe(true)
    expect(isWinAnsiEncodable('Confidentiel — été')).toBe(true)
    expect(isWinAnsiEncodable('€ 100 «draft»')).toBe(true)
  })

  it('rejects text the built-in font would throw on', () => {
    expect(isWinAnsiEncodable('社外秘')).toBe(false)
    expect(isWinAnsiEncodable('КОНФИДЕНЦИАЛЬНО')).toBe(false)
    expect(isWinAnsiEncodable('DRAFT 🔒')).toBe(false)
  })
})
