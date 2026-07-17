import { useState, type FormEvent } from 'react'
import { GeneratorError, generatePasswords } from '../../lib/generator'
import { useSettings } from '../../state/SettingsProvider'
import { useToasts } from '../../state/useToasts'
import { useVault } from '../../state/VaultProvider'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { PasswordInput, TextInput } from '../ui/TextInput'

interface AddEntryDialogProps {
  open: boolean
  onClose: () => void
}

/** Manually add a password to the unlocked vault — one you already use
 *  elsewhere, or a fresh one generated with the user's generator defaults. */
export function AddEntryDialog({ open, onClose }: AddEntryDialogProps) {
  const vault = useVault()
  const { settings } = useSettings()
  const { toast } = useToasts()
  const [label, setLabel] = useState('')
  const [site, setSite] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pwRevealed, setPwRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setLabel('')
    setSite('')
    setUsername('')
    setPassword('')
    setPwRevealed(false)
    setError(null)
    onClose()
  }

  const generate = () => {
    try {
      setPassword(generatePasswords(settings.generator, 1)[0]!)
      // Reveal it: the user should see what just got generated for them.
      setPwRevealed(true)
      setError(null)
    } catch (err) {
      setError(err instanceof GeneratorError ? err.message : 'Could not generate a password.')
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!label.trim()) {
      setError('Give this password a name.')
      return
    }
    if (!password) {
      setError('Enter or generate a password.')
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
    <Dialog open={open} title="Add a password" onClose={close}>
      <form onSubmit={save} className="vault-form">
        <TextInput
          label="Name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. GitHub"
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
        <PasswordInput
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          revealed={pwRevealed}
          onRevealedChange={setPwRevealed}
        />
        <div>
          <Button small onClick={generate}>
            Generate password
          </Button>
        </div>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary" busy={busy}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
