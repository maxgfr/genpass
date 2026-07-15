import { describe, expect, it } from 'vitest'
import {
  CLASS_CHARS,
  SIMILAR_CHARS,
  analyzePool,
  dedupeExclusions,
  type CharsetOptions,
} from './charset'

const allOn: CharsetOptions = {
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  excludeSimilar: false,
  excludeCustom: '',
}

describe('class constants', () => {
  it('pins the exact class contents — silent drift would change real entropy', () => {
    expect(CLASS_CHARS.uppercase).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    expect(CLASS_CHARS.lowercase).toBe('abcdefghijklmnopqrstuvwxyz')
    expect(CLASS_CHARS.digits).toBe('0123456789')
    expect(CLASS_CHARS.symbols).toBe('@&$!#?%^*()-_=+[]{};:,.')
    expect([...SIMILAR_CHARS].sort().join('')).toBe(
      ['0', 'O', 'o', '1', 'l', 'I', '|', '2', 'Z', '5', 'S', '8', 'B'].sort().join(''),
    )
  })
})

describe('dedupeExclusions', () => {
  it('dedupes while preserving first-seen order', () => {
    expect(dedupeExclusions('aabba')).toBe('ab')
    expect(dedupeExclusions('')).toBe('')
    expect(dedupeExclusions('@@!!@')).toBe('@!')
  })
})

describe('analyzePool', () => {
  it('builds the union pool from the selected classes', () => {
    const analysis = analyzePool(allOn)
    expect(analysis.poolEmpty).toBe(false)
    expect(analysis.noClassSelected).toBe(false)
    expect(analysis.pool).toHaveLength(26 + 26 + 10 + 23)
    expect(analysis.guaranteedClasses.map((c) => c.name)).toEqual([
      'uppercase',
      'lowercase',
      'digits',
      'symbols',
    ])
  })

  it('omits deselected classes', () => {
    const analysis = analyzePool({ ...allOn, symbols: false, digits: false })
    expect(analysis.pool).toHaveLength(52)
    expect(analysis.guaranteedClasses.map((c) => c.name)).toEqual(['uppercase', 'lowercase'])
  })

  it('excludeSimilar removes exactly the similar characters and nothing else', () => {
    const analysis = analyzePool({ ...allOn, excludeSimilar: true })
    // uppercase loses O I Z S B (5), lowercase loses o l (2), digits lose 0 1 2 5 8 (5), symbols lose nothing
    expect(analysis.pool).toHaveLength(85 - 12)
    for (const ch of SIMILAR_CHARS) expect(analysis.pool).not.toContain(ch)
    expect(analysis.pool).toContain('3')
    expect(analysis.pool).toContain('a')
    expect(analysis.emptiedClasses).toEqual([])
  })

  it('custom exclusions are removed from pool and class chars', () => {
    const analysis = analyzePool({ ...allOn, excludeCustom: 'abcXYZ@' })
    for (const ch of 'abcXYZ@') expect(analysis.pool).not.toContain(ch)
    const lower = analysis.guaranteedClasses.find((c) => c.name === 'lowercase')!
    expect(lower.chars).toHaveLength(23)
  })

  it('detects a class fully emptied by custom exclusions and drops its guarantee', () => {
    const analysis = analyzePool({ ...allOn, excludeCustom: '0123456789' })
    expect(analysis.emptiedClasses).toEqual(['digits'])
    expect(analysis.guaranteedClasses.map((c) => c.name)).toEqual([
      'uppercase',
      'lowercase',
      'symbols',
    ])
    expect(analysis.poolEmpty).toBe(false)
  })

  it('exclusions compose: similar + custom together can empty a class', () => {
    // digits minus similar = 3 4 6 7 9; exclude those too → digits emptied
    const analysis = analyzePool({ ...allOn, excludeSimilar: true, excludeCustom: '34679' })
    expect(analysis.emptiedClasses).toEqual(['digits'])
  })

  it('reports an entirely empty pool', () => {
    const analysis = analyzePool({
      uppercase: false,
      lowercase: false,
      digits: true,
      symbols: false,
      excludeSimilar: false,
      excludeCustom: '0123456789',
    })
    expect(analysis.poolEmpty).toBe(true)
    expect(analysis.pool).toBe('')
    expect(analysis.guaranteedClasses).toEqual([])
  })

  it('reports when no class is selected at all', () => {
    const analysis = analyzePool({ ...allOn, uppercase: false, lowercase: false, digits: false, symbols: false })
    expect(analysis.noClassSelected).toBe(true)
    expect(analysis.poolEmpty).toBe(true)
  })

  it('ignores excluded characters that are not in any selected class', () => {
    const a = analyzePool(allOn)
    const b = analyzePool({ ...allOn, excludeCustom: 'éé††' })
    expect(b.pool).toBe(a.pool)
    expect(b.emptiedClasses).toEqual([])
  })
})
