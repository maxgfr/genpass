import wordlistRaw from '../assets/eff-large-wordlist.txt?raw'

export const EFF_WORDLIST_SIZE = 7776

/**
 * Parse a newline-separated wordlist, validating it is exactly the EFF large
 * list shape: a truncated or duplicated list would silently reduce the real
 * entropy behind the number the UI displays.
 */
export function parseWordlist(raw: string): string[] {
  const words = raw
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean)
  if (words.length !== EFF_WORDLIST_SIZE) {
    throw new Error(`wordlist must contain exactly ${EFF_WORDLIST_SIZE} words, got ${words.length}`)
  }
  if (new Set(words).size !== EFF_WORDLIST_SIZE) {
    throw new Error('wordlist entries must be unique')
  }
  return words
}

let cached: string[] | null = null

/** The bundled EFF large wordlist, parsed once. */
export function getWordlist(): string[] {
  cached ??= parseWordlist(wordlistRaw)
  return cached
}
