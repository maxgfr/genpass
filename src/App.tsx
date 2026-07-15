import { useCallback, useEffect, useState } from 'react'
import './styles/ui.css'
import './styles/app.css'
import { AppShell, type AppTab } from './components/AppShell'
import { GeneratorView } from './components/generator/GeneratorView'
import { SettingsView } from './components/settings/SettingsView'
import { ShareOpenDialog } from './components/share/ShareOpenDialog'
import { ShareView } from './components/share/ShareView'
import { SaveEntryDialog } from './components/vault/SaveEntryDialog'
import { VaultView } from './components/vault/VaultView'
import { IconButton } from './components/ui/Button'
import { LockIcon } from './components/ui/icons'
import { parseShareFragment, type ParsedShare } from './lib/share'
import { SettingsProvider, useSettings } from './state/SettingsProvider'
import { ToastProvider, useToasts } from './state/useToasts'
import { useAutoLock } from './state/useAutoLock'
import { useThemeEffect } from './state/useTheme'
import { VaultProvider, useVault } from './state/VaultProvider'

function Shell() {
  const { settings } = useSettings()
  const vault = useVault()
  const { toast } = useToasts()
  const [tab, setTab] = useState<AppTab>('generator')
  const [saveTarget, setSaveTarget] = useState<string | null>(null)
  const [sharePrefill, setSharePrefill] = useState<string | null>(null)
  const [openedShare, setOpenedShare] = useState<ParsedShare | null>(null)

  useThemeEffect(settings.theme)

  // Opening the app through a share link (#s=…) surfaces the decrypt dialog.
  useEffect(() => {
    const readHash = () => {
      try {
        const parsed = parseShareFragment(window.location.hash)
        if (parsed) setOpenedShare(parsed)
      } catch {
        toast('This share link is damaged and cannot be opened.', 'error')
      }
    }
    readHash()
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [toast])

  const closeShare = useCallback(() => {
    setOpenedShare(null)
    // Address-bar hygiene: drop the fragment once handled.
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  const share = useCallback((secret: string) => {
    setSharePrefill(secret)
    setTab('share')
  }, [])

  const autoLock = useCallback(() => {
    vault.lock()
    toast('Vault locked after inactivity')
  }, [vault, toast])

  useAutoLock(vault.state.status === 'unlocked', settings.autoLockMinutes * 60_000, autoLock)

  return (
    <>
      <AppShell
        tab={tab}
        onTabChange={(next) => {
          if (tab === 'share' && next !== 'share') setSharePrefill(null)
          setTab(next)
        }}
        headerAction={
          vault.state.status === 'unlocked' ? (
            <IconButton label="Lock vault" onClick={vault.lock}>
              <LockIcon />
            </IconButton>
          ) : undefined
        }
      >
        {tab === 'generator' && <GeneratorView onSave={setSaveTarget} onShare={share} />}
        {tab === 'vault' && <VaultView onShare={share} />}
        {tab === 'share' && <ShareView prefill={sharePrefill} />}
        {tab === 'settings' && <SettingsView />}
      </AppShell>
      <SaveEntryDialog password={saveTarget} onClose={() => setSaveTarget(null)} />
      <ShareOpenDialog parsed={openedShare} onClose={closeShare} />
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
