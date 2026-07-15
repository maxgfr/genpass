// Strength math. Because generation samples uniformly over the effective
// pool, `length × log2(poolSize)` is the true entropy (the per-class
// guarantee trims the space negligibly; shown value is the standard,
// honest figure).

export function passwordEntropyBits(length: number, poolSize: number): number {
  if (length <= 0 || poolSize <= 1) return 0
  return length * Math.log2(poolSize)
}

export function passphraseEntropyBits(opts: {
  wordCount: number
  includeDigit: boolean
  listSize?: number
}): number {
  const listSize = opts.listSize ?? 7776
  let bits = opts.wordCount * Math.log2(listSize)
  // One of 10 digits appended to one of wordCount positions.
  if (opts.includeDigit) bits += Math.log2(10 * opts.wordCount)
  return bits
}

export type StrengthLabel = 'weak' | 'fair' | 'strong' | 'excellent'

export function strengthFromBits(bits: number): StrengthLabel {
  if (bits < 45) return 'weak'
  if (bits < 70) return 'fair'
  if (bits < 100) return 'strong'
  return 'excellent'
}

/** Average-case guesses = 2^(bits-1). Default rate: offline GPU rig, 1e10/s. */
export function crackTimeSeconds(bits: number, guessesPerSecond = 1e10): number {
  return 2 ** (bits - 1) / guessesPerSecond
}

const YEAR = 86_400 * 365

export function formatCrackTime(seconds: number): string {
  if (seconds < 1) return 'instant'
  if (seconds < 60) return `${Math.round(seconds)} seconds`
  if (seconds < 3_600) return `${Math.round(seconds / 60)} minutes`
  if (seconds < 86_400) return `${Math.round(seconds / 3_600)} hours`
  if (seconds < YEAR) return `${Math.round(seconds / 86_400)} days`
  if (seconds < 100 * YEAR) return `${Math.round(seconds / YEAR)} years`
  return 'centuries'
}
