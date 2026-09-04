import { describe, expect, it } from 'vitest'
import { ZipLimitError, crc32, dosDateTime, safeEntryName, zipStore } from './zip'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytes(text: string): Uint8Array {
  return encoder.encode(text)
}

interface ReadEntry {
  name: string
  data: Uint8Array
  crc: number
}

/**
 * A minimal ZIP reader, deliberately written from the spec rather than reusing
 * the writer's helpers: it walks the central directory the way an extractor
 * does, so a wrong offset or a bad length fails here instead of in Finder.
 */
async function readZip(blob: Blob): Promise<{ entries: ReadEntry[]; total: number }> {
  const buffer = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(buffer.buffer)

  let eocd = -1
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('no end-of-central-directory record')

  const total = view.getUint16(eocd + 10, true)
  const directorySize = view.getUint32(eocd + 12, true)
  const directoryOffset = view.getUint32(eocd + 16, true)
  expect(directoryOffset + directorySize).toBe(eocd)

  const entries: ReadEntry[] = []
  let cursor = directoryOffset
  for (let i = 0; i < total; i++) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50)
    const crc = view.getUint32(cursor + 16, true)
    const compressed = view.getUint32(cursor + 20, true)
    const uncompressed = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = decoder.decode(buffer.subarray(cursor + 46, cursor + 46 + nameLength))
    expect(view.getUint16(cursor + 10, true)).toBe(0) // stored, not deflated
    expect(compressed).toBe(uncompressed)

    // Follow the offset into the local header and read the payload from there.
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50)
    const localNameLength = view.getUint16(localOffset + 26, true)
    const extraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + extraLength
    const data = buffer.subarray(dataStart, dataStart + uncompressed)

    entries.push({ name, data, crc })
    cursor += 46 + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true)
  }
  return { entries, total }
}

describe('crc32', () => {
  it('matches the standard check vector', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926)
  })

  it('matches known values for short inputs', () => {
    expect(crc32(new Uint8Array(0))).toBe(0)
    expect(crc32(bytes('a'))).toBe(0xe8b7be43)
    expect(crc32(bytes('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339)
  })

  it('is resumable across chunks', () => {
    const whole = crc32(bytes('123456789'))
    const chunked = crc32(bytes('6789'), crc32(bytes('12345')))
    expect(chunked).toBe(whole)
  })
})

describe('dosDateTime', () => {
  it('packs a date into the MS-DOS fields', () => {
    const { time, date } = dosDateTime(new Date(2024, 2, 15, 13, 45, 30))
    expect(date).toBe(((2024 - 1980) << 9) | (3 << 5) | 15)
    expect(time).toBe((13 << 11) | (45 << 5) | 15) // seconds have 2s resolution
  })

  it('clamps dates before the 1980 epoch instead of underflowing', () => {
    expect(dosDateTime(new Date(1970, 0, 1)).date >> 9).toBe(0)
  })
})

describe('safeEntryName', () => {
  it('neutralises separators and traversal', () => {
    expect(safeEntryName('../../etc/passwd')).toBe('.._.._etc_passwd'.replace(/^\.+/, ''))
    expect(safeEntryName('a\\b.png')).toBe('a_b.png')
  })

  it('never returns an empty name', () => {
    expect(safeEntryName('...')).toBe('file')
    expect(safeEntryName('')).toBe('file')
  })

  it('keeps ordinary unicode names intact', () => {
    expect(safeEntryName('rapport-été.pdf')).toBe('rapport-été.pdf')
  })
})

describe('zipStore', () => {
  it('round-trips every payload back out through a real archive walk', async () => {
    const files = [
      { name: 'one.txt', data: bytes('hello') },
      { name: 'two.bin', data: new Uint8Array([0, 1, 2, 250, 255]) },
      { name: 'empty.txt', data: new Uint8Array(0) },
    ]
    const { entries, total } = await readZip(zipStore(files))

    expect(total).toBe(3)
    expect(entries.map((e) => e.name)).toEqual(['one.txt', 'two.bin', 'empty.txt'])
    for (const [i, entry] of entries.entries()) {
      expect([...entry.data]).toEqual([...files[i]!.data])
      expect(entry.crc).toBe(crc32(files[i]!.data))
    }
  })

  it('produces a blob typed as a ZIP archive', () => {
    expect(zipStore([{ name: 'a.txt', data: bytes('a') }]).type).toBe('application/zip')
  })

  it('writes a valid empty archive', async () => {
    const blob = zipStore([])
    expect(blob.size).toBe(22)
    const { total, entries } = await readZip(blob)
    expect(total).toBe(0)
    expect(entries).toEqual([])
  })

  it('de-duplicates colliding names so no entry is lost', async () => {
    const { entries } = await readZip(
      zipStore([
        { name: 'photo.png', data: bytes('first') },
        { name: 'photo.png', data: bytes('second') },
        { name: 'PHOTO.PNG', data: bytes('third') },
      ]),
    )
    // Collision detection is case-insensitive (macOS and Windows both are),
    // but the user's own capitalisation survives into the archive.
    expect(entries.map((e) => e.name)).toEqual(['photo.png', 'photo (2).png', 'PHOTO (3).PNG'])
    expect(decoder.decode(entries[1]!.data)).toBe('second')
  })

  it('marks filenames as UTF-8 and round-trips non-ASCII names', async () => {
    const { entries } = await readZip(zipStore([{ name: 'rapport-été.pdf', data: bytes('x') }]))
    expect(entries[0]!.name).toBe('rapport-été.pdf')
  })

  it('refuses a batch with more entries than the format can address', () => {
    const files = Array.from({ length: 65_536 }, (_, i) => ({
      name: `f${i}.txt`,
      data: new Uint8Array(0),
    }))
    expect(() => zipStore(files)).toThrow(ZipLimitError)
  })
})
