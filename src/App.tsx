import { useCallback, useState } from 'react'
import './styles/ui.css'
import './styles/app.css'
import { AppShell } from './components/AppShell'
import { GeneratorView } from './components/generator/GeneratorView'
import { SettingsView } from './components/settings/SettingsView'
import { SaveEntryDialog } from './components/vault/SaveEntryDialog'
import { VaultView } from './components/vault/VaultView'
import { Button } from './components/ui/Button'
import { LockIcon } from './components/ui/icons'
import { SettingsProvider, useSettings } from './state/SettingsProvider'
import { ToastProvider, useToasts } from './state/useToasts'
import { useAutoLock } from './state/useAutoLock'
import { useThemeEffect } from './state/useTheme'
import { VaultProvider, useVault } from './state/VaultProvider'

function Shell() {
  const { settings } = useSettings()
  const vault = useVault()
  const { toast } = useToasts()
  const [saveTarget, setSaveTarget] = useState<string | null>(null)

  useThemeEffect(settings.theme)

  const autoLock = useCallback(() => {
    vault.lock()
    toast('Vault locked after inactivity')
  }, [vault, toast])

  useAutoLock(vault.state.status === 'unlocked', settings.autoLockMinutes * 60_000, autoLock)

  return (
    <>
      <AppShell
        headerAction={
          vault.state.status === 'unlocked' ? (
            <Button small onClick={vault.lock}>
              <LockIcon size={14} />
              Lock vault
            </Button>
          ) : undefined
        }
      >
        {(tab) => {
          if (tab === 'generator') return <GeneratorView onSave={setSaveTarget} />
          if (tab === 'vault') return <VaultView />
          return <SettingsView />
        }}
      </AppShell>
      <SaveEntryDialog password={saveTarget} onClose={() => setSaveTarget(null)} />
    </>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <VaultProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </VaultProvider>
    </SettingsProvider>
  )
}
