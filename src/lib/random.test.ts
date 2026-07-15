import { describe, expect, it } from 'vitest'
import { stubRandomSequence } from '../test/helpers'
import { randomBytes, randomInt, secureShuffle } from './random'

describe('randomInt', () => {
  it('stays in [0, max) across many draws', () => {
    for (const max of [1, 2, 6, 10, 94, 7776]) {
      for (let i = 0; i < 2_000; i++) {
        const v = randomInt(max)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(max)
        expect(Number.isInteger(v)).toBe(true)
      }
    }
  })

  it('returns 0 for max = 1 without consuming randomness', () => {
    expect(randomInt(1)).toBe(0)
  })

  it('rejects invalid bounds', () => {
    expect(() => randomInt(0)).toThrow(RangeError)
    expect(() => randomInt(-5)).toThrow(RangeError)
    expect(() => randomInt(1.5)).toThrow(RangeError)
    expect(() => randomInt(2 ** 32 + 1)).toThrow(RangeError)
  })

  it('skips draws at or above the rejection limit instead of folding them (no modulo bias)', () => {
    // For max = 6: limit = 2^32 - (2^32 % 6) = 4294967292. Values >= limit must be
    // rejected; a naive modulo would fold 4294967292 to 0.
    const limit = 2 ** 32 - ((2 ** 32) % 6)
    const restore = stubRandomSequence([limit, limit + 1, 13])
    try {
      expect(randomInt(6)).toBe(13 % 6)
    } finally {
      restore()
    }
  })

  it('is roughly uniform (smoke test, generous bounds)', () => {
    const buckets = new Array(6).fill(0)
    const draws = 60_000
    for (let i = 0; i < draws; i++) buckets[randomInt(6)]++
    for (const count of buckets) {
      expect(count).toBeGreaterThan((draws / 6) * 0.9)
      expect(count).toBeLessThan((draws / 6) * 1.1)
    }
  })
})

describe('secureShuffle', () => {
  it('preserves the multiset and length', () => {
    const input = ['a', 'b', 'b', 'c', 'd', 'e', 'e', 'e']
    const out = secureShuffle(input)
    expect(out).toHaveLength(input.length)
    expect([...out].sort()).toEqual([...input].sort())
    expect(input).toEqual(['a', 'b', 'b', 'c', 'd', 'e', 'e', 'e']) // input untouched
  })

  it('applies Fisher-Yates from the last index down (pinned permutation)', () => {
    // For [x, y, z]: first swap uses randomInt(3), second uses randomInt(2).
    // Scripted draws 0, 0 → swap(2,0) then swap(1,0): [x,y,z] → [z,y,x] → [y,z,x]
    const restore = stubRandomSequence([0, 0])
    try {
      expect(secureShuffle(['x', 'y', 'z'])).toEqual(['y', 'z', 'x'])
    } finally {
      restore()
    }
  })

  it('moves elements across positions over many runs', () => {
    let firstStaysPut = 0
    for (let i = 0; i < 600; i++) {
      if (secureShuffle([1, 2, 3])[0] === 1) firstStaysPut++
    }
    // P(first stays) = 1/3; 600 runs should never look degenerate.
    expect(firstStaysPut).toBeGreaterThan(100)
    expect(firstStaysPut).toBeLessThan(300)
  })
})

describe('randomBytes', () => {
  it('returns n cryptographically random bytes', () => {
    const a = randomBytes(16)
    const b = randomBytes(16)
    expect(a).toBeInstanceOf(Uint8Array)
    expect(a).toHaveLength(16)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })
})
