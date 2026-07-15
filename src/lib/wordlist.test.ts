import { describe, expect, it } from 'vitest'
import { EFF_WORDLIST_SIZE, getWordlist, parseWordlist } from './wordlist'

const validRaw = Array.from({ length: 7776 }, (_, i) => `word${i}`).join('\n')

describe('parseWordlist', () => {
  it('parses exactly 7776 words', () => {
    const words = parseWordlist(validRaw)
    expect(words).toHaveLength(EFF_WORDLIST_SIZE)
    expect(words[0]).toBe('word0')
  })

  it('tolerates CRLF and trailing blank lines', () => {
    expect(parseWordlist(validRaw.replaceAll('\n', '\r\n') + '\r\n')).toHaveLength(7776)
  })

  it('throws on a truncated list', () => {
    expect(() => parseWordlist(validRaw.split('\n').slice(0, 7775).join('\n'))).toThrow(/7776/)
  })

  it('throws on duplicates — silent dupes would reduce real entropy', () => {
    const withDupe = ['word0', ...validRaw.split('\n').slice(0, 7775)].join('\n')
    expect(() => parseWordlist(withDupe)).toThrow(/unique/i)
  })
})

describe('getWordlist', () => {
  it('loads and memoizes the bundled EFF list', () => {
    const words = getWordlist()
    expect(words).toHaveLength(7776)
    expect(words).toContain('abacus')
    expect(getWordlist()).toBe(words) // memoized: same reference
  })
})
