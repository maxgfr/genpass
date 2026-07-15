// The only module allowed to touch crypto.getRandomValues.
// Uniformity matters here: a modulo over a 32-bit draw silently biases low
// values, which for a password generator is a real (if small) entropy loss.

const MAX_UINT32 = 2 ** 32

// One draw per call, no batching: the volumes here are tiny (a 64-char
// password needs 64 draws) and a persistent buffer would make deterministic
// test stubbing impossible.
const word = new Uint32Array(1)

function nextUint32(): number {
  crypto.getRandomValues(word)
  return word[0]!
}

/** Uniform integer in [0, maxExclusive) via rejection sampling — no modulo bias. */
export function randomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > MAX_UINT32) {
    throw new RangeError(`randomInt: maxExclusive must be an integer in [1, 2^32], got ${maxExclusive}`)
  }
  if (maxExclusive === 1) return 0
  const limit = MAX_UINT32 - (MAX_UINT32 % maxExclusive)
  let value: number
  do {
    value = nextUint32()
  } while (value >= limit)
  return value % maxExclusive
}

/** Fisher-Yates shuffle driven by randomInt. Returns a new array. */
export function secureShuffle<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** n cryptographically random bytes (salts, IVs). */
export function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  return bytes
}
