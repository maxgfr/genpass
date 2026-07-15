import { vi } from 'vitest'

/** Production uses 600k PBKDF2 iterations; tests use 1k to stay fast. */
export const TEST_ITERATIONS = 1_000

/** Minimal in-memory Storage for vaultStorage/settings tests. */
export function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  }
}

/**
 * Stub crypto.getRandomValues with a scripted sequence of uint32 values,
 * for deterministic rejection-sampling and shuffle tests.
 * Returns a restore function.
 */
export function stubRandomSequence(values: number[]): () => void {
  let i = 0
  const spy = vi
    .spyOn(globalThis.crypto, 'getRandomValues')
    .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
      if (!(array instanceof Uint32Array)) {
        throw new Error('stubRandomSequence only supports Uint32Array draws')
      }
      for (let j = 0; j < array.length; j++) {
        if (i >= values.length) throw new Error('stubRandomSequence exhausted')
        array[j] = values[i++]! >>> 0
      }
      return array
    })
  return () => spy.mockRestore()
}
