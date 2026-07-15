import { useEffect } from 'react'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const
const RESET_THROTTLE_MS = 1_000

/**
 * Locks after `delayMs` of inactivity. Browsers throttle timers in hidden
 * tabs, so the deadline is also checked on visibilitychange — a tab left
 * open overnight locks the moment it is refocused.
 */
export function useAutoLock(enabled: boolean, delayMs: number, onLock: () => void): void {
  useEffect(() => {
    if (!enabled) return

    let deadline = Date.now() + delayMs
    let lastReset = Date.now()
    const timer = setInterval(() => {
      if (Date.now() >= deadline) {
        cleanup()
        onLock()
      }
    }, 1_000)

    const reset = () => {
      const now = Date.now()
      if (now - lastReset < RESET_THROTTLE_MS) return
      lastReset = now
      deadline = now + delayMs
    }

    const checkNow = () => {
      if (Date.now() >= deadline) {
        cleanup()
        onLock()
      }
    }

    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, reset, { passive: true })
    document.addEventListener('visibilitychange', checkNow)

    function cleanup() {
      clearInterval(timer)
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, reset)
      document.removeEventListener('visibilitychange', checkNow)
    }

    return cleanup
  }, [enabled, delayMs, onLock])
}
