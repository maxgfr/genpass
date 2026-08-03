import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/helpers'
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, loadSettings, saveSettings } from './settings'

describe('settings', () => {
  it('returns defaults on empty storage', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS)
  })

  it('has the documented defaults', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('auto')
    expect(DEFAULT_SETTINGS.autoLockMinutes).toBe(5)
    expect(DEFAULT_SETTINGS.clipboardClearSeconds).toBe(30)
    expect(DEFAULT_SETTINGS.generator.length).toBe(20)
    expect(DEFAULT_SETTINGS.generator.batchSize).toBe(1)
    expect(DEFAULT_SETTINGS.generator.excludeCustom).toBe('')
    expect(DEFAULT_SETTINGS.passphrase.wordCount).toBe(5)
    expect(DEFAULT_SETTINGS.pin.length).toBe(8)
  })

  it('round-trips a full settings object', () => {
    const storage = memoryStorage()
    const custom = {
      ...DEFAULT_SETTINGS,
      theme: 'dark' as const,
      generator: { ...DEFAULT_SETTINGS.generator, excludeCustom: 'aeiou@', batchSize: 10 as const, length: 32 },
      passphrase: { ...DEFAULT_SETTINGS.passphrase, wordCount: 7, separator: '.' as const },
      pin: { length: 6 },
    }
    saveSettings(custom, storage)
    expect(loadSettings(storage)).toEqual(custom)
  })

  it('deep-merges partial stored objects onto defaults', () => {
    const storage = memoryStorage()
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ theme: 'dark' }))
    const loaded = loadSettings(storage)
    expect(loaded.theme).toBe('dark')
    expect(loaded.generator).toEqual(DEFAULT_SETTINGS.generator)
    expect(loaded.autoLockMinutes).toBe(5)
  })

  it('discards invalid field values', () => {
    const storage = memoryStorage()
    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ theme: 'blue', autoLockMinutes: 99, generator: { length: 'long', batchSize: 3 } }),
    )
    const loaded = loadSettings(storage)
    expect(loaded.theme).toBe('auto')
    expect(loaded.autoLockMinutes).toBe(5)
    expect(loaded.generator.length).toBe(20)
    expect(loaded.generator.batchSize).toBe(1)
  })

  it('returns defaults on corrupted JSON without throwing', () => {
    const storage = memoryStorage()
    storage.setItem(SETTINGS_STORAGE_KEY, '{nope')
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })

  it('clamps out-of-range numeric values', () => {
    const storage = memoryStorage()
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ generator: { length: 500 }, passphrase: { wordCount: 50 } }))
    const loaded = loadSettings(storage)
    expect(loaded.generator.length).toBe(64)
    expect(loaded.passphrase.wordCount).toBe(10)
  })

  it('accepts pin as a generator mode and clamps the pin length to its own range', () => {
    const storage = memoryStorage()
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ generator: { mode: 'pin' }, pin: { length: 2 } }))
    const loaded = loadSettings(storage)
    expect(loaded.generator.mode).toBe('pin')
    expect(loaded.pin.length).toBe(4)

    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ pin: { length: 99 } }))
    expect(loadSettings(storage).pin.length).toBe(12)
  })

  it('falls back for an unknown mode and for a blob predating the pin block', () => {
    const storage = memoryStorage()
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ generator: { mode: 'morse', length: 24 } }))
    const loaded = loadSettings(storage)
    expect(loaded.generator.mode).toBe('characters')
    expect(loaded.generator.length).toBe(24)
    expect(loaded.pin).toEqual(DEFAULT_SETTINGS.pin)
  })
})
