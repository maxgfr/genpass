import { describe, expect, it } from 'vitest'
import { stubRandomSequence } from '../test/helpers'
import { generatePassphrase, type PassphraseOptions } from './passphrase'

const fixture = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliett']

const base: PassphraseOptions = {
  wordCount: 4,
  separator: '-',
  capitalize: false,
  includeDigit: false,
}

describe('generatePassphrase', () => {
  it('joins wordCount words from the list with the separator', () => {
    for (const wordCount of [3, 5, 10]) {
      const phrase = generatePassphrase({ ...base, wordCount }, fixture)
      const words = phrase.split('-')
      expect(words).toHaveLength(wordCount)
      for (const w of words) expect(fixture).toContain(w)
    }
  })

  it('supports every separator including empty', () => {
    for (const separator of [' ', '.', '_', ''] as const) {
      const phrase = generatePassphrase({ ...base, separator }, fixture)
      if (separator !== '') expect(phrase.split(separator)).toHaveLength(4)
      else expect(phrase).toMatch(/^[a-z]+$/)
    }
  })

  it('capitalizes the first letter of every word when asked', () => {
    const phrase = generatePassphrase({ ...base, capitalize: true }, fixture)
    for (const w of phrase.split('-')) expect(w).toMatch(/^[A-Z][a-z]*$/)
  })

  it('appends exactly one digit to exactly one word when includeDigit is on', () => {
    for (let i = 0; i < 100; i++) {
      const phrase = generatePassphrase({ ...base, includeDigit: true }, fixture)
      expect(phrase.match(/\d/g)).toHaveLength(1)
      const words = phrase.split('-')
      expect(words.filter((w) => /\d$/.test(w))).toHaveLength(1)
    }
  })

  it('never appends a digit otherwise', () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassphrase(base, fixture)).not.toMatch(/\d/)
    }
  })

  it('is deterministic under a scripted RNG (pinned output)', () => {
    const restore = stubRandomSequence([0, 1, 2])
    try {
      expect(generatePassphrase({ ...base, wordCount: 3 }, fixture)).toBe('alpha-bravo-charlie')
    } finally {
      restore()
    }
  })
})
