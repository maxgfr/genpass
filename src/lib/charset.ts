// Single source of truth for character pools. The generator, the strength
// meter and the UI warnings all consume the same PoolAnalysis so they can
// never disagree about what will actually be generated.

export type CharClass = 'uppercase' | 'lowercase' | 'digits' | 'symbols'

export const CLASS_CHARS: Record<CharClass, string> = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '@&$!#?%^*()-_=+[]{};:,.',
}

const CLASS_ORDER: CharClass[] = ['uppercase', 'lowercase', 'digits', 'symbols']

/** Easily-confused glyph pairs: 0/O/o, 1/l/I/|, 2/Z, 5/S, 8/B. */
export const SIMILAR_CHARS: readonly string[] = ['0', 'O', 'o', '1', 'l', 'I', '|', '2', 'Z', '5', 'S', '8', 'B']

export interface CharsetOptions {
  uppercase: boolean
  lowercase: boolean
  digits: boolean
  symbols: boolean
  excludeSimilar: boolean
  /** User-typed characters to remove from the pool (raw; deduped internally). */
  excludeCustom: string
}

export interface PoolAnalysis {
  /** Union of the effective class chars — what generation actually draws from. */
  pool: string
  /** Selected classes that still have chars: each gets the ≥1-char guarantee. */
  guaranteedClasses: { name: CharClass; chars: string }[]
  /** Selected classes fully removed by exclusions — guarantee dropped, UI warns. */
  emptiedClasses: CharClass[]
  poolEmpty: boolean
  noClassSelected: boolean
}

/** Dedupe user-typed exclusions, preserving first-seen order. */
export function dedupeExclusions(input: string): string {
  return [...new Set(input)].join('')
}

export function analyzePool(options: CharsetOptions): PoolAnalysis {
  const excluded = new Set<string>(dedupeExclusions(options.excludeCustom))
  if (options.excludeSimilar) for (const ch of SIMILAR_CHARS) excluded.add(ch)

  const guaranteedClasses: { name: CharClass; chars: string }[] = []
  const emptiedClasses: CharClass[] = []
  let pool = ''
  let selectedCount = 0

  for (const name of CLASS_ORDER) {
    if (!options[name]) continue
    selectedCount++
    const chars = [...CLASS_CHARS[name]].filter((ch) => !excluded.has(ch)).join('')
    if (chars.length === 0) {
      emptiedClasses.push(name)
    } else {
      guaranteedClasses.push({ name, chars })
      pool += chars
    }
  }

  return {
    pool,
    guaranteedClasses,
    emptiedClasses,
    poolEmpty: pool.length === 0,
    noClassSelected: selectedCount === 0,
  }
}
