import { useState, type FormEvent } from 'react'
import { VaultDecryptError } from '../../lib/vaultCrypto'
import { useVault } from '../../state/VaultProvider'
import { Button } from '../ui/Button'
import { PasswordInput } from '../ui/TextInput'
import { UnlockIcon } from '../ui/icons'

interface UnlockFormProps {
  onUnlocked?: () => void
}

export function UnlockForm({ onUnlocked }: UnlockFormProps) {
  const { unlock } = useVault()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return
    setBusy(true)
    setError(null)
    try {
      await unlock(password)
      setPassword('')
      onUnlocked?.()
    } catch (err) {
      setPassword('')
      setError(
        err instanceof VaultDecryptError
          ? 'Wrong master password, or the vault data is corrupted.'
          : 'Could not unlock the vault.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="vault-form" onSubmit={submit}>
      <div>
        <h2 className="panel__title">Vault locked</h2>
        <p className="vault__locked-hint">Enter your master password to decrypt your saved passwords.</p>
      </div>
      <PasswordInput
        label="Master password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error ?? undefined}
        autoComplete="current-password"
        autoFocus
      />
      <Button type="submit" variant="primary" busy={busy} disabled={!password}>
        <UnlockIcon size={16} />
        Unlock
      </Button>
    </form>
  )
}
