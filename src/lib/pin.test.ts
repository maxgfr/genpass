import { describe, expect, it } from 'vitest'
import { CLASS_CHARS } from './charset'
import { PIN_POOL_SIZE, generatePins } from './pin'
import { PIN_LENGTH_MAX, PIN_LENGTH_MIN } from './settings'

describe('generatePins', () => {
  it('derives the pool size from the digits class', () => {
    expect(PIN_POOL_SIZE).toBe(10)
    expect(CLASS_CHARS.digits).toBe('0123456789')
  })

  it('respects the requested length across the whole exposed range', () => {
    for (let length = PIN_LENGTH_MIN; length <= PIN_LENGTH_MAX; length++) {
      expect(generatePins(length, 1)[0]).toHaveLength(length)
    }
  })

  it('only emits digits (property)', () => {
    for (const pin of generatePins(8, 500)) expect(pin).toMatch(/^\d{8}$/)
  })

  it('draws every digit, and keeps leading zeros (property)', () => {
    const seen = new Set<string>()
    const leading = new Set<string>()
    for (const pin of generatePins(4, 2_000)) {
      for (const ch of pin) seen.add(ch)
      leading.add(pin[0]!)
    }
    expect(seen.size).toBe(10)
    // A PIN is a string, never a number: '0' must survive in first position.
    expect(leading.has('0')).toBe(true)
  })

  it('does not filter obvious patterns, so the drawn space stays uniform', () => {
    // Repdigits are 1/1000 of the 4-digit space, so ~20 are expected here.
    // Zero of them would mean generation had quietly stopped being uniform,
    // and the entropy shown by the strength meter would be a lie.
    const repdigits = generatePins(4, 20_000).filter((pin) => /^(\d)\1{3}$/.test(pin))
    expect(repdigits.length).toBeGreaterThan(0)
  })

  it('returns count independent pins in a batch', () => {
    const batch = generatePins(12, 10)
    expect(batch).toHaveLength(10)
    // Collisions at 12 digits (10^12) are astronomically unlikely.
    expect(new Set(batch).size).toBe(10)
    for (const pin of batch) expect(pin).toMatch(/^\d{12}$/)
  })
})
