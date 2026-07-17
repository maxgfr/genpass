import { useState, type FormEvent } from 'react'
import { generatePassphrase } from '../../lib/passphrase'
import { getWordlist } from '../../lib/wordlist'
import { useSettings } from '../../state/SettingsProvider'
import { useVault } from '../../state/VaultProvider'
import { Button } from '../ui/Button'
import { InlineWarning } from '../ui/InlineWarning'
import { PasswordInput } from '../ui/TextInput'

interface CreateVaultFormProps {
  onCreated?: () => void
}

export function CreateVaultForm({ onCreated }: CreateVaultFormProps) {
  const { createVault } = useVault()
  const { settings } = useSettings()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwRevealed, setPwRevealed] = useState(false)
  const [confirmRevealed, setConfirmRevealed] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggest = () => {
    const phrase = generatePassphrase(settings.passphrase, getWordlist())
    setPassword(phrase)
    setConfirm(phrase)
    // Reveal both: the user has to read the suggestion to memorize it.
    setPwRevealed(true)
    setConfirmRevealed(true)
    setError(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('The passwords do not match.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await createVault(password)
      setPassword('')
      setConfirm('')
      onCreated?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="vault-form" onSubmit={submit}>
      <div>
        <h2 className="panel__title">Create your vault</h2>
        <p className="vault__locked-hint">
          Saved passwords are encrypted with a master password that never leaves this device.
        </p>
      </div>
      <PasswordInput
        label="Master password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint="A long passphrase works well — suggest one below if you prefer."
        autoComplete="new-password"
        revealed={pwRevealed}
        onRevealedChange={setPwRevealed}
      />
      <div>
        <Button small onClick={suggest}>
          Suggest passphrase
        </Button>
      </div>
      <PasswordInput
        label="Confirm master password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={error ?? undefined}
        autoComplete="new-password"
        revealed={confirmRevealed}
        onRevealedChange={setConfirmRevealed}
      />
      <InlineWarning>
        There is no recovery. If you forget this password, your vault cannot be opened — by anyone.
      </InlineWarning>
      <label className="vault-form__ack">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        I understand my vault is unrecoverable without this password.
      </label>
      <Button type="submit" variant="primary" busy={busy} disabled={!acknowledged || !password}>
        Create vault
      </Button>
    </form>
  )
}
