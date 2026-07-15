import { describe, expect, it } from 'vitest'

// Placeholder so the walking-skeleton CI run has a test to execute.
// Replaced by the real suites from Phase 1 onward.
describe('walking skeleton', () => {
  it('runs vitest with Web Crypto available', () => {
    expect(typeof globalThis.crypto.getRandomValues).toBe('function')
    expect(typeof globalThis.crypto.subtle.deriveKey).toBe('function')
  })
})
