import { describe, expect, it } from 'vitest'
import {
  defaultOutputFor,
  outputFilename,
  outputOptionsFor,
  sniffBytes,
  sniffKind,
  type FileKind,
} from './fileKind'

function bytes(...values: (number | string)[]): Uint8Array {
  const out: number[] = []
  for (const value of values) {
    if (typeof value === 'number') out.push(value)
    else for (const ch of value) out.push(ch.charCodeAt(0))
  }
  return new Uint8Array(out)
}

const PNG = bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13)
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16, 'JFIF')
const WEBP = bytes('RIFF', 0x24, 0, 0, 0, 'WEBPVP8 ')
const HEIC = bytes(0, 0, 0, 0x18, 'ftypheic', 0, 0, 0, 0, 'mif1heic')
const PDF = bytes('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n')

describe('sniffBytes', () => {
  it('recognises every supported signature', () => {
    expect(sniffBytes(PNG)).toBe('png')
    expect(sniffBytes(JPEG)).toBe('jpeg')
    expect(sniffBytes(WEBP)).toBe('webp')
    expect(sniffBytes(HEIC)).toBe('heic')
    expect(sniffBytes(PDF)).toBe('pdf')
  })

  it('accepts every HEIF still-image brand Apple and Android emit', () => {
    for (const brand of ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']) {
      expect(sniffBytes(bytes(0, 0, 0, 0x18, 'ftyp', brand))).toBe('heic')
    }
  })

  it('rejects ISO-BMFF containers that are not still images', () => {
    expect(sniffBytes(bytes(0, 0, 0, 0x18, 'ftypisom'))).toBeNull() // MP4 video
    expect(sniffBytes(bytes(0, 0, 0, 0x18, 'ftypavif'))).toBeNull() // AVIF, no decoder here
  })

  it('tolerates a PDF header that is not at offset 0', () => {
    expect(sniffBytes(bytes('\r\n   ', '%PDF-1.4'))).toBe('pdf')
  })

  it('does not mistake a RIFF container that is not WebP', () => {
    expect(sniffBytes(bytes('RIFF', 0x24, 0, 0, 0, 'WAVEfmt '))).toBeNull()
  })

  it('returns null for unknown, empty and truncated input', () => {
    expect(sniffBytes(bytes('hello world'))).toBeNull()
    expect(sniffBytes(new Uint8Array(0))).toBeNull()
    expect(sniffBytes(bytes(0x89, 'PN'))).toBeNull()
  })
})

describe('sniffKind', () => {
  it('classifies by bytes even when the browser reports the wrong MIME type', async () => {
    const file = new File([PNG as BlobPart], 'photo.jpg', { type: 'image/jpeg' })
    await expect(sniffKind(file)).resolves.toBe('png')
  })

  it('falls back to the extension for MIME-less HEIC', async () => {
    // An .heic whose first bytes are unreadable/atypical still has to be caught:
    // iOS shares these with type: ''.
    const file = new File([bytes('garbage garbage') as BlobPart], 'IMG_0042.HEIC', { type: '' })
    await expect(sniffKind(file)).resolves.toBe('heic')
  })

  it('returns null for a file that is neither sniffable nor named like HEIC', async () => {
    const file = new File([bytes('notes') as BlobPart], 'notes.txt', { type: 'text/plain' })
    await expect(sniffKind(file)).resolves.toBeNull()
  })
})

describe('outputOptionsFor', () => {
  it('keeps a PDF a PDF — there is no rasteriser', () => {
    expect(outputOptionsFor('pdf')).toEqual(['pdf'])
  })

  it('offers the input format first for images', () => {
    expect(outputOptionsFor('png')[0]).toBe('png')
    expect(outputOptionsFor('webp')[0]).toBe('webp')
  })

  it('never offers HEIC as an output — no browser can encode it', () => {
    for (const kind of ['png', 'jpeg', 'webp', 'heic', 'pdf'] as FileKind[]) {
      expect(outputOptionsFor(kind)).not.toContain('heic')
    }
  })

  it('lets any image become a PDF', () => {
    for (const kind of ['png', 'jpeg', 'webp', 'heic'] as FileKind[]) {
      expect(outputOptionsFor(kind)).toContain('pdf')
    }
  })
})

describe('defaultOutputFor', () => {
  it('defaults to the input format', () => {
    expect(defaultOutputFor('pdf')).toBe('pdf')
    expect(defaultOutputFor('png')).toBe('png')
    expect(defaultOutputFor('jpeg')).toBe('jpeg')
    expect(defaultOutputFor('webp')).toBe('webp')
  })

  it('defaults HEIC to JPEG, and that default is a valid option', () => {
    expect(defaultOutputFor('heic')).toBe('jpeg')
    expect(outputOptionsFor('heic')).toContain('jpeg')
  })
})

describe('outputFilename', () => {
  it('replaces the extension and marks the file', () => {
    expect(outputFilename('report.pdf', 'pdf')).toBe('report-watermarked.pdf')
    expect(outputFilename('photo.png', 'jpeg')).toBe('photo-watermarked.jpg')
  })

  it('keeps dots that are part of the name', () => {
    expect(outputFilename('2024.q1.report.pdf', 'pdf')).toBe('2024.q1.report-watermarked.pdf')
  })

  it('handles a name with no extension and a name that is only an extension', () => {
    expect(outputFilename('scan', 'png')).toBe('scan-watermarked.png')
    expect(outputFilename('.gitignore', 'png')).toBe('.gitignore-watermarked.png')
  })
})
