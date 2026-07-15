// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { installMatchMediaMock } from '../test/helpers'
import { useThemeEffect } from './useTheme'

afterEach(() => {
  delete document.documentElement.dataset.theme
})

describe('useThemeEffect', () => {
  it('stamps explicit light and dark', () => {
    const { rerender } = renderHook(({ theme }) => useThemeEffect(theme), {
      initialProps: { theme: 'dark' as 'light' | 'dark' | 'auto' },
    })
    expect(document.documentElement.dataset.theme).toBe('dark')
    rerender({ theme: 'light' })
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('resolves auto from the OS preference and follows changes live', () => {
    const media = installMatchMediaMock(true)
    renderHook(() => useThemeEffect('auto'))
    expect(document.documentElement.dataset.theme).toBe('dark')
    act(() => media.setDark(false))
    expect(document.documentElement.dataset.theme).toBe('light')
    act(() => media.setDark(true))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('stops following the OS after switching to an explicit theme', () => {
    const media = installMatchMediaMock(false)
    const { rerender } = renderHook(({ theme }) => useThemeEffect(theme), {
      initialProps: { theme: 'auto' as 'light' | 'dark' | 'auto' },
    })
    expect(document.documentElement.dataset.theme).toBe('light')
    rerender({ theme: 'dark' })
    act(() => media.setDark(true))
    expect(document.documentElement.dataset.theme).toBe('dark')
    act(() => media.setDark(false))
    expect(document.documentElement.dataset.theme).toBe('dark') // explicit wins
  })
})
