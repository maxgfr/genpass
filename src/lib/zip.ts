/**
 * A store-only ZIP writer, in about 150 lines and with no dependency.
 *
 * Store-only (method 0, no compression) is the right call here rather than a
 * shortcut: every payload this app puts in an archive is a PDF, JPEG, PNG or
 * WebP, all of which are already compressed. Deflating them would burn CPU on
 * a phone to save one or two percent. If text-heavy payloads ever land here,
 * `CompressionStream('deflate-raw')` turns this into a method-8 writer without
 * a dependency either.
 *
 * No Zip64: the 32-bit fields cap an archive at 4 GiB and 65,535 entries, and
 * past that we throw rather than emit a file that silently unpacks wrong.
 */

/** Raised when the archive would overflow ZIP's 32-bit fields. */
export class ZipLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ZipLimitError'
  }
}

export interface ZipFile {
  name: string
  data: Uint8Array
}

const MAX_ENTRIES = 0xffff
const MAX_BYTES = 0xffffffff

let crcTable: Uint32Array | null = null

function table(): Uint32Array {
  if (crcTable) return crcTable
  const next = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    next[i] = c >>> 0
  }
  crcTable = next
  return next
}

/** CRC-32/ISO-HDLC, the variant ZIP uses. `seed` continues a running sum. */
export function crc32(data: Uint8Array, seed = 0): number {
  const t = table()
  let c = (seed ^ 0xffffffff) >>> 0
  for (let i = 0; i < data.length; i++) {
    c = (t[(c ^ data[i]!) & 0xff]! ^ (c >>> 8)) >>> 0
  }
  return (c ^ 0xffffffff) >>> 0
}

/** MS-DOS packed date and time — 2-second resolution, epoch 1980. */
export function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/**
 * Strip anything that would make an entry escape its archive or upset an
 * extractor: path separators, traversal, control characters.
 */
export function safeEntryName(name: string): string {
  const cleaned = [...name]
    .map((ch) => (ch === '/' || ch === '\\' ? '_' : ch))
    .filter((ch) => {
      const code = ch.codePointAt(0)!
      return code > 0x1f && code !== 0x7f
    })
    .join('')
  return cleaned.replace(/^\.+/, '') || 'file'
}

/** `photo.png`, `photo (2).png`, … so two inputs never collide in the archive. */
function dedupe(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const key = name.toLowerCase()
    const count = seen.get(key) ?? 0
    seen.set(key, count + 1)
    if (count === 0) return name
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    return `${stem} (${count + 1})${ext}`
  })
}

interface Writer {
  bytes: Uint8Array
  view: DataView
  offset: number
}

function writer(size: number): Writer {
  const bytes = new Uint8Array(size)
  return { bytes, view: new DataView(bytes.buffer), offset: 0 }
}

function u16(w: Writer, value: number): void {
  w.view.setUint16(w.offset, value, true)
  w.offset += 2
}

function u32(w: Writer, value: number): void {
  w.view.setUint32(w.offset, value >>> 0, true)
  w.offset += 4
}

function raw(w: Writer, value: Uint8Array): void {
  w.bytes.set(value, w.offset)
  w.offset += value.length
}

interface Entry {
  name: Uint8Array
  crc: number
  size: number
  offset: number
  time: number
  date: number
}

/** Bit 11 tells the extractor the filename is UTF-8, not CP437. */
const UTF8_FLAG = 0x0800
const VERSION_NEEDED = 20

function localFileHeader(entry: Entry): Uint8Array {
  const w = writer(30 + entry.name.length)
  u32(w, 0x04034b50)
  u16(w, VERSION_NEEDED)
  u16(w, UTF8_FLAG)
  u16(w, 0) // method: stored
  u16(w, entry.time)
  u16(w, entry.date)
  u32(w, entry.crc)
  u32(w, entry.size) // compressed
  u32(w, entry.size) // uncompressed
  u16(w, entry.name.length)
  u16(w, 0) // extra field length
  raw(w, entry.name)
  return w.bytes
}

function centralDirectoryHeader(entry: Entry): Uint8Array {
  const w = writer(46 + entry.name.length)
  u32(w, 0x02014b50)
  u16(w, VERSION_NEEDED) // version made by
  u16(w, VERSION_NEEDED)
  u16(w, UTF8_FLAG)
  u16(w, 0)
  u16(w, entry.time)
  u16(w, entry.date)
  u32(w, entry.crc)
  u32(w, entry.size)
  u32(w, entry.size)
  u16(w, entry.name.length)
  u16(w, 0) // extra
  u16(w, 0) // comment
  u16(w, 0) // disk number start
  u16(w, 0) // internal attributes
  u32(w, 0) // external attributes
  u32(w, entry.offset)
  raw(w, entry.name)
  return w.bytes
}

function endOfCentralDirectory(count: number, size: number, offset: number): Uint8Array {
  const w = writer(22)
  u32(w, 0x06054b50)
  u16(w, 0) // this disk
  u16(w, 0) // disk with the central directory
  u16(w, count)
  u16(w, count)
  u32(w, size)
  u32(w, offset)
  u16(w, 0) // comment length
  return w.bytes
}

/**
 * Build the archive.
 *
 * Assembled as a Blob from its parts rather than one contiguous buffer: a
 * batch of watermarked photos runs to hundreds of megabytes, and the browser
 * backs a multi-part Blob without ever holding the whole thing in one
 * allocation.
 */
export function zipStore(files: ZipFile[], now = new Date()): Blob {
  if (files.length > MAX_ENTRIES) {
    throw new ZipLimitError(`A ZIP archive holds at most ${MAX_ENTRIES} files.`)
  }

  const encoder = new TextEncoder()
  const names = dedupe(files.map((f) => safeEntryName(f.name)))
  const { time, date } = dosDateTime(now)

  const parts: BlobPart[] = []
  const entries: Entry[] = []
  let offset = 0

  for (const [index, file] of files.entries()) {
    if (file.data.length > MAX_BYTES) {
      throw new ZipLimitError(`${file.name} is too large for a ZIP archive.`)
    }
    const entry: Entry = {
      name: encoder.encode(names[index]!),
      crc: crc32(file.data),
      size: file.data.length,
      offset,
      time,
      date,
    }
    const header = localFileHeader(entry)
    parts.push(header as BlobPart, file.data as BlobPart)
    offset += header.length + file.data.length
    if (offset > MAX_BYTES) {
      throw new ZipLimitError('This batch is too large for a ZIP archive.')
    }
    entries.push(entry)
  }

  const directoryOffset = offset
  let directorySize = 0
  for (const entry of entries) {
    const header = centralDirectoryHeader(entry)
    parts.push(header as BlobPart)
    directorySize += header.length
  }

  parts.push(endOfCentralDirectory(entries.length, directorySize, directoryOffset) as BlobPart)
  return new Blob(parts, { type: 'application/zip' })
}
