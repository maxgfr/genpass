import type { ReactNode } from 'react'
import { KeyholeIcon } from './ui/icons'

export type AppTab = 'generator' | 'vault' | 'share' | 'settings'

const TABS: { id: AppTab; label: string }[] = [
  { id: 'generator', label: 'Generator' },
  { id: 'vault', label: 'Vault' },
  { id: 'share', label: 'Share & QR' },
  { id: 'settings', label: 'Settings' },
]

interface AppShellProps {
  tab: AppTab
  onTabChange: (tab: AppTab) => void
  headerAction?: ReactNode
  children: ReactNode
}

export function AppShell({ tab, onTabChange, headerAction, children }: AppShellProps) {
  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__wordmark">
            <KeyholeIcon size={22} />
            genpass
          </h1>
          <p className="app__tagline">Passwords generated and stored on your device only.</p>
        </div>
        {headerAction}
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className="tabs__tab"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => onTabChange(id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              const index = TABS.findIndex((t) => t.id === tab)
              const next = TABS[(index + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!
              onTabChange(next.id)
              document.getElementById(`tab-${next.id}`)?.focus()
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <main id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="app__view">
        {children}
      </main>
    </div>
  )
}
