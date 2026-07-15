// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoLock } from './useAutoLock'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const DELAY = 5 * 60_000

describe('useAutoLock', () => {
  it('fires onLock once after the inactivity delay', () => {
    const onLock = vi.fn()
    renderHook(() => useAutoLock(true, DELAY, onLock))
    vi.advanceTimersByTime(DELAY + 1_000)
    expect(onLock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(DELAY * 2)
    expect(onLock).toHaveBeenCalledTimes(1)
  })

  it('activity resets the deadline', () => {
    const onLock = vi.fn()
    renderHook(() => useAutoLock(true, DELAY, onLock))
    vi.advanceTimersByTime(DELAY - 1_000)
    window.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(2_000)
    expect(onLock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(DELAY)
    expect(onLock).toHaveBeenCalledTimes(1)
  })

  it('does nothing when disabled', () => {
    const onLock = vi.fn()
    renderHook(() => useAutoLock(false, DELAY, onLock))
    vi.advanceTimersByTime(DELAY * 3)
    expect(onLock).not.toHaveBeenCalled()
  })

  it('locks on visibilitychange return when the deadline passed in a throttled background tab', () => {
    const onLock = vi.fn()
    renderHook(() => useAutoLock(true, DELAY, onLock))
    // Simulate a background tab whose timer never fired: jump the clock past
    // the deadline without running timers, then refocus.
    vi.setSystemTime(Date.now() + DELAY + 60_000)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onLock).toHaveBeenCalledTimes(1)
  })

  it('tears down listeners and timer on unmount', () => {
    const onLock = vi.fn()
    const { unmount } = renderHook(() => useAutoLock(true, DELAY, onLock))
    unmount()
    vi.advanceTimersByTime(DELAY * 2)
    window.dispatchEvent(new Event('pointerdown'))
    expect(onLock).not.toHaveBeenCalled()
  })
})
