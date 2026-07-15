// Persisted app settings — non-sensitive only. Never a password, never vault
// content. Unknown or invalid stored values fall back to defaults so a stale
// or hand-edited blob can never break the app.

import type { PassphraseSeparator } from './passphrase'

export const SETTINGS_STORAGE_KEY = 'genpass.settings'

export interface GeneratorSettings {
  mode: 'characters' | 'passphrase'
  length: number
  uppercase: boolean
  lowercase: boolean
  digits: boolean
  symbols: boolean
  excludeSimilar: boolean
  excludeCustom: string
  batchSize: 1 | 10
}

export interface PassphraseSettings {
  wordCount: number
  separator: PassphraseSeparator
  capitalize: boolean
  includeDigit: boolean
}

export interface Settings {
  version: 1
  theme: 'light' | 'dark' | 'auto'
  autoLockMinutes: 1 | 5 | 15 | 30
  clipboardClearSeconds: 0 | 15 | 30 | 60
  generator: GeneratorSettings
  passphrase: PassphraseSettings
}

export const LENGTH_MIN = 8
export const LENGTH_MAX = 64
export const WORD_COUNT_MIN = 3
export const WORD_COUNT_MAX = 10

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: 'auto',
  autoLockMinutes: 5,
  clipboardClearSeconds: 30,
  generator: {
    mode: 'characters',
    length: 20,
    uppercase: true,
    lowercase: true,
    digits: true,
    symbols: true,
    excludeSimilar: false,
    excludeCustom: '',
    batchSize: 1,
  },
  passphrase: {
    wordCount: 5,
    separator: '-',
    capitalize: true,
    includeDigit: false,
  },
}

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function mergeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS
  if (typeof raw !== 'object' || raw === null) return d
  const o = raw as Record<string, unknown>
  const g = (typeof o.generator === 'object' && o.generator !== null ? o.generator : {}) as Record<string, unknown>
  const p = (typeof o.passphrase === 'object' && o.passphrase !== null ? o.passphrase : {}) as Record<string, unknown>
  return {
    version: 1,
    theme: pick(o.theme, ['light', 'dark', 'auto'] as const, d.theme),
    autoLockMinutes: pick(o.autoLockMinutes, [1, 5, 15, 30] as const, d.autoLockMinutes),
    clipboardClearSeconds: pick(o.clipboardClearSeconds, [0, 15, 30, 60] as const, d.clipboardClearSeconds),
    generator: {
      mode: pick(g.mode, ['characters', 'passphrase'] as const, d.generator.mode),
      length: clampInt(g.length, LENGTH_MIN, LENGTH_MAX, d.generator.length),
      uppercase: bool(g.uppercase, d.generator.uppercase),
      lowercase: bool(g.lowercase, d.generator.lowercase),
      digits: bool(g.digits, d.generator.digits),
      symbols: bool(g.symbols, d.generator.symbols),
      excludeSimilar: bool(g.excludeSimilar, d.generator.excludeSimilar),
      excludeCustom: str(g.excludeCustom, d.generator.excludeCustom),
      batchSize: pick(g.batchSize, [1, 10] as const, d.generator.batchSize),
    },
    passphrase: {
      wordCount: clampInt(p.wordCount, WORD_COUNT_MIN, WORD_COUNT_MAX, d.passphrase.wordCount),
      separator: pick(p.separator, ['-', ' ', '.', '_', ''] as const, d.passphrase.separator),
      capitalize: bool(p.capitalize, d.passphrase.capitalize),
      includeDigit: bool(p.includeDigit, d.passphrase.includeDigit),
    },
  }
}

function defaultStorage(): Storage {
  return globalThis.localStorage
}

export function loadSettings(storage: Storage = defaultStorage()): Settings {
  const raw = storage.getItem(SETTINGS_STORAGE_KEY)
  if (raw === null) return DEFAULT_SETTINGS
  try {
    return mergeSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings, storage: Storage = defaultStorage()): void {
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Settings persistence is best-effort; the in-memory value still applies.
  }
}
