import { describe, expect, it } from 'vitest'
import { CLASS_CHARS, SIMILAR_CHARS, type CharsetOptions } from './charset'
import { GeneratorError, generatePassword, generatePasswords } from './generator'

const allOn: CharsetOptions = {
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  excludeSimilar: false,
  excludeCustom: '',
}

function classesIn(password: string): Set<string> {
  const found = new Set<string>()
  for (const ch of password) {
    for (const [name, chars] of Object.entries(CLASS_CHARS)) {
      if (chars.includes(ch)) found.add(name)
    }
  }
  return found
}

describe('generatePassword', () => {
  it('respects the requested length', () => {
    for (const length of [8, 20, 33, 64]) {
      expect(generatePassword({ ...allOn, length })).toHaveLength(length)
    }
  })

  it('only emits characters from the effective pool', () => {
    const pool = new Set(CLASS_CHARS.uppercase + CLASS_CHARS.digits)
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword({ ...allOn, lowercase: false, symbols: false, length: 12 })
      for (const ch of pw) expect(pool.has(ch)).toBe(true)
    }
  })

  it('guarantees at least one character from every selected class (property, length 4)', () => {
    for (let i = 0; i < 1_000; i++) {
      const pw = generatePassword({ ...allOn, length: 4 })
      expect(classesIn(pw).size).toBe(4)
    }
  })

  it('never emits similar characters when excluded (property)', () => {
    const similar = new Set(SIMILAR_CHARS)
    for (let i = 0; i < 1_000; i++) {
      const pw = generatePassword({ ...allOn, excludeSimilar: true, length: 24 })
      for (const ch of pw) expect(similar.has(ch)).toBe(false)
    }
  })

  it('never emits custom-excluded characters (property)', () => {
    const excluded = new Set('aeiouAEIOU@')
    for (let i = 0; i < 500; i++) {
      const pw = generatePassword({ ...allOn, excludeCustom: 'aeiouAEIOU@', length: 24 })
      for (const ch of pw) expect(excluded.has(ch)).toBe(false)
    }
  })

  it('drops the guarantee for an emptied class but keeps the others', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword({ ...allOn, excludeCustom: '0123456789', length: 4 })
      const classes = classesIn(pw)
      expect(classes.has('digits')).toBe(false)
      expect(classes.has('uppercase')).toBe(true)
      expect(classes.has('lowercase')).toBe(true)
      expect(classes.has('symbols')).toBe(true)
    }
  })

  it('has no positional bias: every class appears in first position over many runs', () => {
    const firstCharClasses = new Set<string>()
    for (let i = 0; i < 2_000; i++) {
      const pw = generatePassword({ ...allOn, length: 4 })
      for (const cls of classesIn(pw[0]!)) firstCharClasses.add(cls)
    }
    expect(firstCharClasses.size).toBe(4)
  })
})

describe('generatePasswords (batch)', () => {
  it('returns count independent, valid passwords', () => {
    const batch = generatePasswords({ ...allOn, length: 16 }, 10)
    expect(batch).toHaveLength(10)
    expect(new Set(batch).size).toBe(10) // collisions at 16 chars are astronomically unlikely
    for (const pw of batch) {
      expect(pw).toHaveLength(16)
      expect(classesIn(pw).size).toBe(4)
    }
  })

  it('a batch of one matches the single-generate contract', () => {
    const batch = generatePasswords({ ...allOn, length: 12 }, 1)
    expect(batch).toHaveLength(1)
    expect(batch[0]).toHaveLength(12)
  })
})

describe('error cases', () => {
  it('throws NO_CLASS_SELECTED when nothing is enabled', () => {
    const opts = { ...allOn, uppercase: false, lowercase: false, digits: false, symbols: false, length: 12 }
    expect(() => generatePassword(opts)).toThrowError(
      expect.objectContaining({ code: 'NO_CLASS_SELECTED' }),
    )
  })

  it('throws EMPTY_POOL when exclusions remove everything', () => {
    const opts = {
      ...allOn,
      uppercase: false,
      lowercase: false,
      symbols: false,
      excludeCustom: '0123456789',
      length: 12,
    }
    expect(() => generatePassword(opts)).toThrowError(expect.objectContaining({ code: 'EMPTY_POOL' }))
  })

  it('throws LENGTH_TOO_SHORT when length cannot honor the guarantees', () => {
    expect(() => generatePassword({ ...allOn, length: 3 })).toThrowError(
      expect.objectContaining({ code: 'LENGTH_TOO_SHORT' }),
    )
    expect(GeneratorError).toBeDefined()
  })
})
