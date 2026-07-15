import './styles/ui.css'
import './styles/app.css'
import { AppShell } from './components/AppShell'
import { GeneratorView } from './components/generator/GeneratorView'
import { SettingsProvider, useSettings } from './state/SettingsProvider'
import { ToastProvider } from './state/useToasts'
import { useThemeEffect } from './state/useTheme'

function Shell() {
  const { settings } = useSettings()
  useThemeEffect(settings.theme)

  return (
    <AppShell>
      {(tab) => {
        if (tab === 'generator') return <GeneratorView />
        if (tab === 'vault') return <p>Vault — coming in Phase 5.</p>
        return <p>Settings — coming in Phase 7.</p>
      }}
    </AppShell>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </SettingsProvider>
  )
}
