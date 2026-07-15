import { describe, expect, it } from 'vitest'
import { qrMatrix, qrSvgPath } from './qr'

describe('qrMatrix', () => {
  it('encodes short text into a version-1 (21×21) matrix', () => {
    const m = qrMatrix('hello')
    expect(m.size).toBe(21)
  })

  it('is deterministic for the same input', () => {
    const a = qrMatrix('genpass')
    const b = qrMatrix('genpass')
    for (let y = 0; y < a.size; y++) {
      for (let x = 0; x < a.size; x++) {
        expect(a.isDark(x, y)).toBe(b.isDark(x, y))
      }
    }
  })

  it('contains the three finder patterns (7×7 corner squares)', () => {
    const m = qrMatrix('finder check')
    // Outer border of each finder pattern is dark; check a few canonical points.
    const corners: [number, number][] = [
      [0, 0],
      [m.size - 7, 0],
      [0, m.size - 7],
    ]
    for (const [cx, cy] of corners) {
      expect(m.isDark(cx, cy)).toBe(true) // top-left of the square
      expect(m.isDark(cx + 6, cy + 6)).toBe(true) // bottom-right corner
      expect(m.isDark(cx + 3, cy + 3)).toBe(true) // center dot
      expect(m.isDark(cx + 1, cy + 1)).toBe(false) // inner white ring
    }
  })

  it('grows for longer payloads', () => {
    const short = qrMatrix('a')
    const long = qrMatrix('https://maxgfr.github.io/genpass/#s='.padEnd(300, 'x'))
    expect(long.size).toBeGreaterThan(short.size)
  })
})

describe('qrSvgPath', () => {
  it('emits one square per dark module', () => {
    const m = qrMatrix('svg')
    let dark = 0
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.isDark(x, y)) dark++
    const path = qrSvgPath(m)
    expect(path.match(/M/g)).toHaveLength(dark)
    expect(path).toMatch(/^M/)
  })
})
