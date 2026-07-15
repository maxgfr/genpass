import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { loadSettings, saveSettings, type Settings } from '../lib/settings'

interface SettingsApi {
  settings: Settings
  update: (patch: Partial<Omit<Settings, 'version'>>) => void
}

const SettingsContext = createContext<SettingsApi | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const update = useCallback((patch: Partial<Omit<Settings, 'version'>>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsApi {
  const api = useContext(SettingsContext)
  if (!api) throw new Error('useSettings must be used inside <SettingsProvider>')
  return api
}
