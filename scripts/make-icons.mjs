// Zero-dependency PWA icon generator: renders the genpass keyhole mark
// (white keyhole on brand green) straight to PNG via node:zlib.
// Usage: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const GREEN = [0x22, 0x7a, 0x3e]
const WHITE = [0xff, 0xff, 0xff]

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Coverage of the keyhole glyph at unit coords (u, v), glyph scaled by g around center. */
function inKeyhole(u, v, g) {
  const x = (u - 0.5) / g + 0.5
  const y = (v - 0.5) / g + 0.5
  const dx = x - 0.5
  const dy = y - 0.407
  if (dx * dx + dy * dy <= 0.152 * 0.152) return true
  if (y >= 0.49 && y <= 0.735) {
    const t = (y - 0.49) / (0.735 - 0.49)
    const half = 0.055 + t * 0.05
    if (Math.abs(x - 0.5) <= half) return true
  }
  return false
}

function render(size, glyphScale) {
  const pixels = Buffer.alloc(size * size * 4)
  const SUB = 3
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const u = (x + (sx + 0.5) / SUB) / size
          const v = (y + (sy + 0.5) / SUB) / size
          if (inKeyhole(u, v, glyphScale)) cover++
        }
      }
      const a = cover / (SUB * SUB)
      const i = (y * size + x) * 4
      pixels[i] = Math.round(GREEN[0] * (1 - a) + WHITE[0] * a)
      pixels[i + 1] = Math.round(GREEN[1] * (1 - a) + WHITE[1] * a)
      pixels[i + 2] = Math.round(GREEN[2] * (1 - a) + WHITE[2] * a)
      pixels[i + 3] = 255
    }
  }
  return png(size, pixels)
}

const outDir = fileURLToPath(new URL('../public/icons', import.meta.url))
mkdirSync(outDir, { recursive: true })
writeFileSync(`${outDir}/pwa-192.png`, render(192, 1))
writeFileSync(`${outDir}/pwa-512.png`, render(512, 1))
writeFileSync(`${outDir}/maskable-512.png`, render(512, 0.72))
console.log('icons written to public/icons')
