// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { ToastProvider, useToasts } from './useToasts'

function Probe() {
  const { toast } = useToasts()
  return (
    <>
      <button onClick={() => toast('saved ok')}>info</button>
      <button onClick={() => toast('boom', 'error')}>error</button>
    </>
  )
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useToasts', () => {
  it('shows a toast in the polite live region and auto-dismisses it', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    )
    act(() => screen.getByText('info').click())
    expect(screen.getByText('saved ok')).toBeTruthy()
    act(() => vi.advanceTimersByTime(3_000))
    expect(screen.queryByText('saved ok')).toBeNull()
  })

  it('styles error toasts distinctly and stacks multiple toasts', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    )
    act(() => screen.getByText('info').click())
    act(() => screen.getByText('error').click())
    expect(screen.getByText('saved ok')).toBeTruthy()
    expect(screen.getByText('boom').className).toContain('toast--error')
  })
})
