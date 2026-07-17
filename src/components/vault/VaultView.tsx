import { useState } from 'react'
import '../../styles/vault.css'
import { useVault } from '../../state/VaultProvider'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { InlineWarning } from '../ui/InlineWarning'
import { LockIcon, PlusIcon } from '../ui/icons'
import { AddEntryDialog } from './AddEntryDialog'
import { CreateVaultForm } from './CreateVaultForm'
import { EntryRow } from './EntryRow'
import { UnlockForm } from './UnlockForm'
import { VaultToolbarExtras } from './ExportImport'

interface VaultViewProps {
  onShare?: (password: string) => void
}

export function VaultView({ onShare }: VaultViewProps = {}) {
  const vault = useVault()
  const [adding, setAdding] = useState(false)

  if (vault.corrupt) {
    return (
      <InlineWarning danger>
        The stored vault data could not be read. It has not been touched — if you have an exported
        backup, erase the vault from Settings, create a fresh one, and import the backup.
      </InlineWarning>
    )
  }

  switch (vault.state.status) {
    case 'loading':
      return null
    case 'uninitialized':
      return (
        <section className="panel">
          <CreateVaultForm />
        </section>
      )
    case 'locked':
      return (
        <section className="panel">
          <UnlockForm />
        </section>
      )
    case 'unlocked': {
      const { entries } = vault.state
      return (
        <>
          <div className="vault__toolbar">
            <span className="vault__count">
              {entries.length === 0
                ? 'No saved passwords'
                : `${entries.length} saved ${entries.length === 1 ? 'password' : 'passwords'}`}
            </span>
            <div className="vault__actions">
              <Button small onClick={() => setAdding(true)}>
                <PlusIcon size={14} />
                Add
              </Button>
              <VaultToolbarExtras />
              <Button small onClick={vault.lock}>
                <LockIcon size={14} />
                Lock
              </Button>
            </div>
          </div>
          {entries.length === 0 ? (
            <EmptyState title="Your vault is empty">
              Generate a password and save it from the generator, or use Add above to store one you
              already have — everything stays encrypted on this device.
            </EmptyState>
          ) : (
            <ul className="vault__list">
              {entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} onShare={onShare} />
              ))}
            </ul>
          )}
          <AddEntryDialog open={adding} onClose={() => setAdding(false)} />
        </>
      )
    }
  }
}
