// Clipboard with best-effort auto-clear. The clear can legitimately fail
// (browsers refuse writes while the document is unfocused) — that limit is
// stated in the Settings copy, not hidden.

let pendingClear: ReturnType<typeof setTimeout> | null = null

function cancelPendingClear(): void {
  if (pendingClear !== null) {
    clearTimeout(pendingClear)
    pendingClear = null
  }
}

/** Must be called synchronously inside the user gesture (Safari). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Copy, then clear the clipboard after `clearAfterMs` (0 = never).
 * A newer copy always cancels an older pending clear so fresher clipboard
 * content is never wiped.
 */
export function copyWithAutoClear(
  text: string,
  clearAfterMs: number,
): { done: Promise<boolean>; cancel: () => void } {
  cancelPendingClear()
  const done = copyText(text)
  if (clearAfterMs > 0) {
    const timer = setTimeout(() => {
      if (pendingClear === timer) pendingClear = null
      navigator.clipboard.writeText('').catch(() => {})
    }, clearAfterMs)
    pendingClear = timer
  }
  return { done, cancel: cancelPendingClear }
}
