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

export interface CanvasMock {
  /** The single recording context every getContext('2d') call returns. */
  ctx: Record<string, ReturnType<typeof vi.fn>> & { measureText: ReturnType<typeof vi.fn> }
  /** How many times text was stamped — one call per watermark placement. */
  fillTextCalls: () => { text: string; x: number; y: number }[]
  restore: () => void
}

/**
 * jsdom implements none of the canvas surface: no `getContext`, no `toBlob`,
 * no `createImageBitmap`. Rather than pull in the native `canvas` package (a
 * compiled dependency in a repo whose CI is a plain `npm ci`), record the calls
 * and assert on those — the geometry itself is unit-tested in Node, so what is
 * left to prove here is that the renderer reaches the canvas at all.
 */
export function installCanvasMock(): CanvasMock {
  const fillText = vi.fn()
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    fillText,
    // Linear in the font size, like every real implementation.
    measureText: vi.fn((text: string) => ({
      width: text.length * 0.55 * fontSizeOf(ctx.font),
    })),
    font: '10px sans-serif',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    lineWidth: 1,
    textAlign: 'start',
    textBaseline: 'alphabetic',
  } as unknown as CanvasMock['ctx'] & { font: string }

  const originalGetContext = HTMLCanvasElement.prototype.getContext
  const originalToBlob = HTMLCanvasElement.prototype.toBlob
  const originalCreateImageBitmap = globalThis.createImageBitmap

  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as typeof originalGetContext
  HTMLCanvasElement.prototype.toBlob = function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    callback(new Blob(['stub'], { type: type ?? 'image/png' }))
  }
  globalThis.createImageBitmap = (async (source: unknown) => ({
    width: (source as { width?: number }).width ?? 800,
    height: (source as { height?: number }).height ?? 600,
    close: () => {},
  })) as unknown as typeof createImageBitmap

  return {
    ctx,
    fillTextCalls: () =>
      fillText.mock.calls.map(([text, x, y]) => ({
        text: text as string,
        x: x as number,
        y: y as number,
      })),
    restore() {
      HTMLCanvasElement.prototype.getContext = originalGetContext
      HTMLCanvasElement.prototype.toBlob = originalToBlob
      globalThis.createImageBitmap = originalCreateImageBitmap
    },
  }
}

function fontSizeOf(font: string): number {
  return Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 10)
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
