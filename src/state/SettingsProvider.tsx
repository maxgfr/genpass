import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { loadSettings, saveSettings, type Settings } from '../lib/settings'

interface SettingsApi {
  settings: Settings
  update: (patch: Partial<Omit<Settings, 'version'>>) => void
  /** True when the last change could not be stored: it will be lost on reload. */
  unsaved: boolean
}

const SettingsContext = createContext<SettingsApi | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [unsaved, setUnsaved] = useState(false)

  const loaded = useRef(settings)

  const update = useCallback((patch: Partial<Omit<Settings, 'version'>>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  // Persist every change (not the settings just loaded), and remember if it could not be kept.
  useEffect(() => {
    if (settings === loaded.current) return
    setUnsaved(!saveSettings(settings))
  }, [settings])

  return <SettingsContext.Provider value={{ settings, update, unsaved }}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsApi {
  const api = useContext(SettingsContext)
  if (!api) throw new Error('useSettings must be used inside <SettingsProvider>')
  return api
}
