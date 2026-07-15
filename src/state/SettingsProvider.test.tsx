// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../lib/settings'
import { SettingsProvider, useSettings } from './SettingsProvider'

function Probe() {
  const { settings, update } = useSettings()
  return (
    <div>
      <span data-testid="theme">{settings.theme}</span>
      <span data-testid="length">{settings.generator.length}</span>
      <button onClick={() => update({ theme: 'dark' })}>set-dark</button>
      <button onClick={() => update({ generator: { ...settings.generator, length: 42 } })}>set-length</button>
    </div>
  )
}

beforeEach(() => localStorage.clear())

describe('SettingsProvider', () => {
  it('provides defaults when storage is empty', () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe(DEFAULT_SETTINGS.theme)
  })

  it('updates persist to localStorage and survive a remount', () => {
    const { unmount } = render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    act(() => screen.getByText('set-dark').click())
    act(() => screen.getByText('set-length').click())
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toMatchObject({
      theme: 'dark',
      generator: { length: 42 },
    })
    unmount()
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(screen.getByTestId('length').textContent).toBe('42')
  })
})
