import { useState, type FormEvent } from 'react'
import { useToasts } from '../../state/useToasts'
import { useVault } from '../../state/VaultProvider'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { TextInput } from '../ui/TextInput'
import { CreateVaultForm } from './CreateVaultForm'
import { UnlockForm } from './UnlockForm'

interface SaveEntryDialogProps {
  /** The generated password to save; null closes the dialog. */
  password: string | null
  onClose: () => void
}

export function SaveEntryDialog({ password, onClose }: SaveEntryDialogProps) {
  const vault = useVault()
  const { toast } = useToasts()
  const [label, setLabel] = useState('')
  const [site, setSite] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setLabel('')
    setSite('')
    setUsername('')
    setError(null)
    onClose()
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return
    if (!label.trim()) {
      setError('Give this password a name.')
      return
    }
    setBusy(true)
    try {
      await vault.addEntry({
        label: label.trim(),
        site: site.trim() || undefined,
        username: username.trim() || undefined,
        password,
      })
      toast(`Saved ${label.trim()} to the vault`)
      close()
    } catch {
      setError('Could not save the entry.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={password !== null} title="Save to vault" onClose={close}>
      {vault.state.status === 'uninitialized' && <CreateVaultForm />}
      {vault.state.status === 'locked' && <UnlockForm />}
      {vault.state.status === 'unlocked' && (
        <form onSubmit={save} className="vault-form">
          <TextInput
            label="Name"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. GitHub"
            error={error ?? undefined}
            autoFocus
          />
          <TextInput
            label="Website (optional)"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="github.com"
          />
          <TextInput
            label="Username (optional)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="you@example.com"
          />
          <div className="dialog__actions">
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" variant="primary" busy={busy}>
              Save
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
