import { describe, expect, it } from 'vitest'
import {
  crackTimeSeconds,
  formatCrackTime,
  passphraseEntropyBits,
  passwordEntropyBits,
  strengthFromBits,
} from './entropy'

describe('passwordEntropyBits', () => {
  it('is exact: length × log2(poolSize)', () => {
    expect(passwordEntropyBits(20, 94)).toBeCloseTo(20 * Math.log2(94), 10)
    expect(passwordEntropyBits(8, 26)).toBeCloseTo(8 * Math.log2(26), 10)
  })

  it('returns 0 for degenerate pools', () => {
    expect(passwordEntropyBits(20, 0)).toBe(0)
    expect(passwordEntropyBits(20, 1)).toBe(0)
    expect(passwordEntropyBits(0, 94)).toBe(0)
  })
})

describe('passphraseEntropyBits', () => {
  it('is wordCount × log2(7776) for the EFF list', () => {
    expect(passphraseEntropyBits({ wordCount: 5, includeDigit: false })).toBeCloseTo(
      5 * Math.log2(7776),
      10,
    )
    expect(passphraseEntropyBits({ wordCount: 6, includeDigit: false })).toBeCloseTo(77.55, 2)
  })

  it('adds log2(10 × wordCount) when a digit is appended at a random word', () => {
    expect(passphraseEntropyBits({ wordCount: 5, includeDigit: true })).toBeCloseTo(
      5 * Math.log2(7776) + Math.log2(50),
      10,
    )
  })

  it('supports custom list sizes', () => {
    expect(passphraseEntropyBits({ wordCount: 4, includeDigit: false, listSize: 2048 })).toBeCloseTo(
      44,
      10,
    )
  })
})

describe('strengthFromBits', () => {
  it('maps thresholds at exact boundaries', () => {
    expect(strengthFromBits(0)).toBe('weak')
    expect(strengthFromBits(44.9)).toBe('weak')
    expect(strengthFromBits(45)).toBe('fair')
    expect(strengthFromBits(69.9)).toBe('fair')
    expect(strengthFromBits(70)).toBe('strong')
    expect(strengthFromBits(99.9)).toBe('strong')
    expect(strengthFromBits(100)).toBe('excellent')
    expect(strengthFromBits(200)).toBe('excellent')
  })
})

describe('crackTimeSeconds', () => {
  it('uses average-case 2^(bits-1) at 1e10 guesses/s by default', () => {
    expect(crackTimeSeconds(40)).toBeCloseTo(2 ** 39 / 1e10, 6)
    expect(crackTimeSeconds(40, 1e3)).toBeCloseTo(2 ** 39 / 1e3, 4)
  })
})

describe('formatCrackTime', () => {
  it('formats each magnitude', () => {
    expect(formatCrackTime(0.4)).toBe('instant')
    expect(formatCrackTime(30)).toBe('30 seconds')
    expect(formatCrackTime(60 * 5)).toBe('5 minutes')
    expect(formatCrackTime(3600 * 5)).toBe('5 hours')
    expect(formatCrackTime(86_400 * 3)).toBe('3 days')
    expect(formatCrackTime(86_400 * 365 * 12)).toBe('12 years')
    expect(formatCrackTime(86_400 * 365 * 250)).toBe('centuries')
    expect(formatCrackTime(1e30)).toBe('centuries')
  })
})
