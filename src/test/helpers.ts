import { vi } from 'vitest'

/** Production uses 1M PBKDF2 iterations; tests use 1k to stay fast. */
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
 * Controllable matchMedia mock for theme tests (jsdom lacks matchMedia).
 * Install before rendering; drive OS-level changes with setDark().
 */
export function installMatchMediaMock(initialDark = false): { setDark: (dark: boolean) => void } {
  let dark = initialDark
  const listeners = new Set<(e: { matches: boolean }) => void>()
  const mql = {
    get matches() {
      return dark
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, cb: (e: { matches: boolean }) => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: (e: { matches: boolean }) => void) => listeners.delete(cb),
    addListener: (cb: (e: { matches: boolean }) => void) => listeners.add(cb),
    removeListener: (cb: (e: { matches: boolean }) => void) => listeners.delete(cb),
    dispatchEvent: () => false,
  }
  window.matchMedia = (() => mql) as unknown as typeof window.matchMedia
  return {
    setDark(next: boolean) {
      dark = next
      for (const cb of listeners) cb({ matches: dark })
    },
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
