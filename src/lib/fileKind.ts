/**
 * What did the user drop, and what can it become.
 *
 * Classification is by magic bytes, never by `File.type`: Safari and Android
 * hand over HEIC photos with an empty or plainly wrong MIME type, and a file
 * dragged out of an archive often has no type at all. The extension is only a
 * last resort, and only for HEIC — the one format whose signature browsers
 * routinely fail to label.
 */

export type FileKind = 'pdf' | 'png' | 'jpeg' | 'webp' | 'heic'
export type OutputFormat = 'pdf' | 'png' | 'jpeg' | 'webp'

/** Bytes of the file we need in order to classify it. */
export const SNIFF_BYTES = 512

/**
 * ISO-BMFF brands that mean "still image we can hand to a HEIF decoder".
 * `mif1`/`msf1` are the generic image brands Apple emits alongside `heic`.
 */
const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevx',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
])

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = ''
  for (let i = start; i < start + length; i++) {
    const byte = bytes[i]
    if (byte === undefined) return ''
    out += String.fromCharCode(byte)
  }
  return out
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((byte, i) => bytes[i] === byte)
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const

/** Pure classifier over the head of a file. Returns null for anything else. */
export function sniffBytes(head: Uint8Array): FileKind | null {
  if (startsWith(head, PNG_SIGNATURE)) return 'png'
  if (startsWith(head, JPEG_SIGNATURE)) return 'jpeg'
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') return 'webp'
  if (ascii(head, 4, 4) === 'ftyp' && HEIF_BRANDS.has(ascii(head, 8, 4))) return 'heic'
  // Some scanners and mail gateways prepend junk before the header. Readers
  // tolerate it, so we do too rather than rejecting a file the user can open.
  if (ascii(head, 0, head.length).includes('%PDF-')) return 'pdf'
  return null
}

/** HEIC arrives MIME-less often enough that the extension has to count. */
function sniffExtension(name: string): FileKind | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'heic'
  return null
}

export async function sniffKind(file: File): Promise<FileKind | null> {
  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer())
  return sniffBytes(head) ?? sniffExtension(file.name)
}

/**
 * What this input can be written back as.
 *
 * A PDF stays a PDF: pdf-lib does not rasterise, so there is no honest path
 * from a PDF page to a PNG here. Any image can become any image, or a
 * single-page PDF.
 */
export function outputOptionsFor(kind: FileKind): OutputFormat[] {
  if (kind === 'pdf') return ['pdf']
  const own: OutputFormat[] = kind === 'heic' ? [] : [kind]
  const rest = (['jpeg', 'png', 'webp'] as const).filter((f) => f !== kind)
  return [...own, ...rest, 'pdf']
}

/**
 * The input's own format, so "do nothing but add the watermark" is the default.
 * HEIC is the exception: no browser can *encode* HEIC, so it lands on JPEG —
 * which is also what Apple's own "Most Compatible" export produces.
 */
export function defaultOutputFor(kind: FileKind): OutputFormat {
  return kind === 'heic' ? 'jpeg' : kind
}

const MIME: Record<OutputFormat, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

const EXTENSION: Record<OutputFormat, string> = {
  pdf: '.pdf',
  png: '.png',
  jpeg: '.jpg',
  webp: '.webp',
}

export function mimeFor(format: OutputFormat): string {
  return MIME[format]
}

export function extensionFor(format: OutputFormat): string {
  return EXTENSION[format]
}

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: 'PDF',
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP',
  heic: 'HEIC',
}

export const FORMAT_LABEL: Record<OutputFormat, string> = {
  pdf: 'PDF',
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP',
}

/** `report.pdf` + png → `report-watermarked.png`. Keeps dots inside the stem. */
export function outputFilename(inputName: string, format: OutputFormat): string {
  const dot = inputName.lastIndexOf('.')
  const stem = dot > 0 ? inputName.slice(0, dot) : inputName
  return `${stem || 'document'}-watermarked${extensionFor(format)}`
}
