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
  })

  it('round-trips a full settings object', () => {
    const storage = memoryStorage()
    const custom = {
      ...DEFAULT_SETTINGS,
      theme: 'dark' as const,
      generator: { ...DEFAULT_SETTINGS.generator, excludeCustom: 'aeiou@', batchSize: 10 as const, length: 32 },
      passphrase: { ...DEFAULT_SETTINGS.passphrase, wordCount: 7, separator: '.' as const },
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
})
