import { afterEach } from 'vitest'

// Runs for every test file. DOM-specific setup only applies in jsdom files
// (which declare `// @vitest-environment jsdom`); lib tests run in node.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react')
  afterEach(cleanup)

  // jsdom ships getRandomValues but not SubtleCrypto — use Node's real webcrypto.
  if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import('node:crypto')
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }

  // jsdom implements <dialog> but not showModal/close.
  if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true
    }
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
  }

  // jsdom has no canvas at all: getContext logs "Not implemented" and returns
  // null, toBlob throws, createImageBitmap is absent. A silent baseline keeps
  // any component that merely *renders* a canvas quiet — including effects
  // that land after a test's own recording mock has been torn down.
  // `installCanvasMock()` layers a recording context on top when a test wants
  // to assert what was drawn.
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as
    typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback, type?: string) {
    callback(new Blob([], { type: type ?? 'image/png' }))
  }
  if (typeof globalThis.createImageBitmap !== 'function') {
    globalThis.createImageBitmap = (async () => ({
      width: 1,
      height: 1,
      close: () => {},
    })) as unknown as typeof createImageBitmap
  }

  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
}
