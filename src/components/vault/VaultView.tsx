import '../../styles/vault.css'
import { useVault } from '../../state/VaultProvider'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { InlineWarning } from '../ui/InlineWarning'
import { LockIcon } from '../ui/icons'
import { CreateVaultForm } from './CreateVaultForm'
import { EntryRow } from './EntryRow'
import { UnlockForm } from './UnlockForm'
import { VaultToolbarExtras } from './ExportImport'

export function VaultView() {
  const vault = useVault()

  if (vault.corrupt) {
    return (
      <InlineWarning danger>
        The stored vault data could not be read. It has not been touched — if you have an exported
        backup, clear this site's data and import it.
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
              <VaultToolbarExtras />
              <Button small onClick={vault.lock}>
                <LockIcon size={14} />
                Lock
              </Button>
            </div>
          </div>
          {entries.length === 0 ? (
            <EmptyState title="Your vault is empty">
              Generate a password, then use its save button to keep it here — encrypted on this
              device.
            </EmptyState>
          ) : (
            <ul className="vault__list">
              {entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </>
      )
    }
  }
}
