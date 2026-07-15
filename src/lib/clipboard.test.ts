// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyText, copyWithAutoClear } from './clipboard'

const writeText = vi.fn<(text: string) => Promise<void>>()

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('copyText', () => {
  it('writes the text and resolves true', async () => {
    await expect(copyText('secret')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('secret')
  })

  it('resolves false when the clipboard rejects', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    await expect(copyText('secret')).resolves.toBe(false)
  })
})

describe('copyWithAutoClear', () => {
  it('clears the clipboard after the delay (best-effort)', async () => {
    const { done } = copyWithAutoClear('secret', 30_000)
    await expect(done).resolves.toBe(true)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(writeText).toHaveBeenLastCalledWith('')
    expect(writeText).toHaveBeenCalledTimes(2)
  })

  it('does not schedule a clear when delay is 0', async () => {
    const { done } = copyWithAutoClear('secret', 0)
    await done
    await vi.advanceTimersByTimeAsync(120_000)
    expect(writeText).toHaveBeenCalledTimes(1)
  })

  it('cancel() prevents the pending clear', async () => {
    const { done, cancel } = copyWithAutoClear('secret', 30_000)
    await done
    cancel()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(writeText).toHaveBeenCalledTimes(1)
  })

  it('a newer copy cancels the older pending clear — never wipes fresher content', async () => {
    const first = copyWithAutoClear('first', 30_000)
    await first.done
    await vi.advanceTimersByTimeAsync(20_000)
    const second = copyWithAutoClear('second', 30_000)
    await second.done
    // First clear would fire at t=30s; it must not (canceled by the second copy).
    await vi.advanceTimersByTimeAsync(15_000)
    expect(writeText).not.toHaveBeenCalledWith('')
    // Second clear fires at its own t+30s.
    await vi.advanceTimersByTimeAsync(15_000)
    expect(writeText).toHaveBeenLastCalledWith('')
    expect(writeText.mock.calls.filter(([t]) => t === '')).toHaveLength(1)
  })

  it('swallows clear failures (document unfocused)', async () => {
    writeText.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('unfocused'))
    const { done } = copyWithAutoClear('secret', 30_000)
    await done
    await expect(vi.advanceTimersByTimeAsync(30_000)).resolves.not.toThrow()
  })
})
