import { fontSizeFor, watermarkPlacements, type WatermarkConfig } from './watermark'

/**
 * PDF renderer, on top of pdf-lib.
 *
 * pdf-lib is imported dynamically everywhere in this module so that it never
 * lands in the initial chunk — the generator and the vault must not pay for a
 * PDF writer they never call.
 *
 * The watermark is drawn as real PDF text, not as a rasterised overlay: it
 * stays crisp at any zoom, adds kilobytes rather than megabytes, and leaves the
 * document's own text selectable underneath.
 */

/** A PDF we cannot open because it is encrypted. */
export class ProtectedPdfError extends Error {
  constructor() {
    super('This PDF is password-protected.')
    this.name = 'ProtectedPdfError'
  }
}

/** A PDF that pdf-lib could not parse. */
export class BrokenPdfError extends Error {
  constructor() {
    super('This PDF could not be read — the file may be damaged.')
    this.name = 'BrokenPdfError'
  }
}

/**
 * The built-in Helvetica is WinAnsi (CP1252) only: pdf-lib throws on anything
 * outside it. Checked before we start, so a Cyrillic or CJK watermark produces
 * a clear warning in the form rather than a failure at download time.
 */
export function isWinAnsiEncodable(text: string): boolean {
  return [...text].every((ch) => {
    const code = ch.codePointAt(0)!
    return code <= 0xff ? code !== 0x81 && code !== 0x8d && code !== 0x8f : WIN_ANSI_HIGH.has(ch)
  })
}

/** The CP1252 characters that live above U+00FF. */
const WIN_ANSI_HIGH = new Set([
  '€',
  '‚',
  'ƒ',
  '„',
  '…',
  '†',
  '‡',
  'ˆ',
  '‰',
  'Š',
  '‹',
  'Œ',
  'Ž',
  '‘',
  '’',
  '“',
  '”',
  '•',
  '–',
  '—',
  '˜',
  '™',
  'š',
  '›',
  'œ',
  'ž',
  'Ÿ',
])

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return { r: 0, g: 0, b: 0 }
  const value = Number.parseInt(match[1]!, 16)
  return {
    r: ((value >> 16) & 0xff) / 255,
    g: ((value >> 8) & 0xff) / 255,
    b: (value & 0xff) / 255,
  }
}

/**
 * Load a document, translating pdf-lib's failures into ones the UI can phrase.
 *
 * Deliberately not `ignoreEncryption: true`: with it pdf-lib leaves content
 * streams encrypted and writes a file that opens blank. Refusing is the honest
 * answer.
 */
async function load(bytes: Uint8Array) {
  const { PDFDocument, EncryptedPDFError } = await import('pdf-lib')
  try {
    // updateMetadata: false, or pdf-lib stamps its own Producer and a fresh
    // ModDate into the user's document on load. Not this app's business, and
    // it is `load` that does it — `save` has no such option.
    const doc = await PDFDocument.load(bytes, { updateMetadata: false })
    // Walk the page tree here rather than letting it blow up mid-render:
    // pdf-lib parses leniently and a file can survive `load` only to fail on
    // the first page access, which the caller would then see as a crash.
    doc.getPageCount()
    return doc
  } catch (err) {
    // pdf-lib ships an ES5-transpiled build, so its custom errors lose their
    // prototype chain and `instanceof` alone silently never matches. The
    // message is the reliable signal; the instanceof is kept for the day the
    // library ships a modern build.
    const encrypted =
      err instanceof EncryptedPDFError ||
      (err instanceof Error && /is encrypted/i.test(err.message))
    if (encrypted) throw new ProtectedPdfError()
    throw new BrokenPdfError()
  }
}

export interface PdfInfo {
  pageCount: number
  /** Page 1's visible size, with any /Rotate already applied. */
  first: { width: number; height: number }
}

/** Read the shape of a PDF, for the schematic preview and for early validation. */
export async function readPdfInfo(bytes: Uint8Array): Promise<PdfInfo> {
  const doc = await load(bytes)
  const page = doc.getPage(0)
  const { width, height } = page.getSize()
  const rotation = ((page.getRotation().angle % 360) + 360) % 360
  const quarterTurn = rotation === 90 || rotation === 270
  return {
    pageCount: doc.getPageCount(),
    first: quarterTurn ? { width: height, height: width } : { width, height },
  }
}

export async function watermarkPdf(bytes: Uint8Array, cfg: WatermarkConfig): Promise<Uint8Array> {
  const { StandardFonts, degrees, rgb } = await import('pdf-lib')
  const doc = await load(bytes)
  if (!cfg.text.trim()) return doc.save()

  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const { r, g, b } = hexToRgb(cfg.color)
  const color = rgb(r, g, b)

  for (const page of doc.getPages()) {
    const size = page.getSize()
    // A scanned page often carries /Rotate 90. Lay the watermark out against
    // what the reader shows, then undo the turn when placing it, so the text
    // reads horizontally on screen rather than up the side of the page.
    const rotation = ((page.getRotation().angle % 360) + 360) % 360
    const quarterTurn = rotation === 90 || rotation === 270
    const visible = quarterTurn
      ? { width: size.height, height: size.width }
      : { width: size.width, height: size.height }

    const fontSize = fontSizeFor(cfg, visible.width, visible.height)
    const text = { width: font.widthOfTextAtSize(cfg.text, fontSize), height: fontSize }
    const placements = watermarkPlacements(cfg, visible, text)

    for (const placement of placements) {
      // Normalized (y down, visible frame) → PDF user space (y up, real page).
      const vx = placement.x * visible.width
      const vy = placement.y * visible.height
      const centre = unrotatePoint(vx, vy, visible, rotation)

      // The viewer turns the whole page by `rotation`, so the angle written
      // into user space has to be pre-compensated for the watermark to read at
      // `cfg.angleDeg` on screen. pdf-lib measures counter-clockwise in the
      // y-up user space; the config is clockwise on a y-down screen.
      const screenAngle = cfg.angleDeg - rotation
      const radians = (-screenAngle * Math.PI) / 180

      // pdf-lib anchors text at the baseline's left end and rotates about that
      // point, so shift from the centre of the box ourselves — the canvas
      // renderer gets the same placement free via textAlign/textBaseline.
      const dx = -text.width / 2
      // Helvetica's cap height is ~0.72em, so the optical centre of an
      // all-caps stamp sits half that above the baseline.
      const dy = -fontSize * 0.36
      page.drawText(cfg.text, {
        x: centre.x + dx * Math.cos(radians) - dy * Math.sin(radians),
        y: centre.y + dx * Math.sin(radians) + dy * Math.cos(radians),
        size: fontSize,
        font,
        color,
        opacity: Math.min(1, Math.max(0, cfg.opacity)),
        rotate: degrees(-screenAngle),
      })
    }
  }

  // updateMetadata: false — pdf-lib otherwise stamps its own Producer and a
  // fresh ModDate into the user's document. Not this app's business.
  return doc.save()
}

/**
 * Map a point from the page as the reader sees it back into PDF user space,
 * for a page carrying /Rotate.
 */
export function unrotatePoint(
  x: number,
  y: number,
  visible: { width: number; height: number },
  rotation: number,
): { x: number; y: number } {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return { x: y, y: x }
    case 180:
      return { x: visible.width - x, y: y }
    case 270:
      return { x: visible.height - y, y: visible.width - x }
    default:
      // No rotation: only the y-axis flips, PDF space grows upwards.
      return { x, y: visible.height - y }
  }
}

/**
 * Wrap an already-watermarked image in a single-page PDF sized to the image.
 *
 * The watermark is burned into the pixels by `watermarkImage` before this runs,
 * for two reasons: pdf-lib can embed only PNG and JPEG, so WebP and HEIC need a
 * canvas re-encode regardless; and doing both in one pass guarantees the PDF
 * shows exactly what the preview showed.
 */
export async function imageToPdf(
  bytes: Uint8Array,
  format: 'png' | 'jpeg',
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')
  // No Producer, no Creator, no timestamps: the output should say nothing
  // about the tool that made it.
  const doc = await PDFDocument.create({ updateMetadata: false })
  const image = format === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
  const page = doc.addPage([image.width, image.height])
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  return doc.save()
}
