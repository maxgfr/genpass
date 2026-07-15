import { useState, type ReactNode } from 'react'
import { KeyIcon } from './ui/icons'

export type AppTab = 'generator' | 'vault' | 'settings'

const TABS: { id: AppTab; label: string }[] = [
  { id: 'generator', label: 'Generator' },
  { id: 'vault', label: 'Vault' },
  { id: 'settings', label: 'Settings' },
]

interface AppShellProps {
  headerAction?: ReactNode
  children: (tab: AppTab) => ReactNode
}

export function AppShell({ headerAction, children }: AppShellProps) {
  const [tab, setTab] = useState<AppTab>('generator')

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__wordmark">
            <KeyIcon size={20} />
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
            onClick={() => setTab(id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              const index = TABS.findIndex((t) => t.id === tab)
              const next = TABS[(index + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!
              setTab(next.id)
              document.getElementById(`tab-${next.id}`)?.focus()
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <main id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="app__view">
        {children(tab)}
      </main>
    </div>
  )
}
