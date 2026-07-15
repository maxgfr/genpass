import { useState, type FormEvent } from 'react'
import { useVault } from '../../state/VaultProvider'
import { Button } from '../ui/Button'
import { InlineWarning } from '../ui/InlineWarning'
import { PasswordInput } from '../ui/TextInput'

const MIN_LENGTH = 10

interface CreateVaultFormProps {
  onCreated?: () => void
}

export function CreateVaultForm({ onCreated }: CreateVaultFormProps) {
  const { createVault } = useVault()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`)
      return
    }
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
        hint={`At least ${MIN_LENGTH} characters. A long passphrase works well.`}
        autoComplete="new-password"
      />
      <PasswordInput
        label="Confirm master password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={error ?? undefined}
        autoComplete="new-password"
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
      <Button type="submit" variant="primary" busy={busy} disabled={!acknowledged}>
        Create vault
      </Button>
    </form>
  )
}
