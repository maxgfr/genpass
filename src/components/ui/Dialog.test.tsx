// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

describe('Dialog', () => {
  it('renders nothing when closed and opens modally when open', () => {
    const { rerender } = render(
      <Dialog open={false} title="Test" onClose={vi.fn()}>
        <p>body</p>
      </Dialog>,
    )
    expect(screen.queryByText('body')).toBeNull()
    rerender(
      <Dialog open title="Test" onClose={vi.fn()}>
        <p>body</p>
      </Dialog>,
    )
    expect(screen.getByText('body')).toBeTruthy()
    expect((document.querySelector('dialog') as HTMLDialogElement).open).toBe(true)
  })

  it('calls onClose on backdrop click but not on content click', () => {
    const onClose = vi.fn()
    render(
      <Dialog open title="Test" onClose={onClose}>
        <p>body</p>
      </Dialog>,
    )
    fireEvent.click(screen.getByText('body'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('dialog')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the native close event fires (Escape)', () => {
    const onClose = vi.fn()
    render(
      <Dialog open title="Test" onClose={onClose}>
        <p>body</p>
      </Dialog>,
    )
    fireEvent(document.querySelector('dialog')!, new Event('close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
