import { useState, type FormEvent } from 'react'
import '../../styles/share.css'
import { copyText } from '../../lib/clipboard'
import { ShareExpiredError, openShare, type ParsedShare, type SharePayload } from '../../lib/share'
import { VaultDecryptError } from '../../lib/vaultCrypto'
import { useToasts } from '../../state/useToasts'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { PasswordInput } from '../ui/TextInput'

interface ShareOpenDialogProps {
  parsed: ParsedShare | null
  onClose: () => void
}

/** Shown when the app is opened through a share link (#s=…). */
export function ShareOpenDialog({ parsed, onClose }: ShareOpenDialogProps) {
  const { toast } = useToasts()
  const [passphrase, setPassphrase] = useState('')
  const [payload, setPayload] = useState<SharePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expiredAt, setExpiredAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const close = () => {
    setPayload(null)
    setPassphrase('')
    setError(null)
    setExpiredAt(null)
    onClose()
  }

  const reveal = async (e: FormEvent) => {
    e.preventDefault()
    if (!parsed) return
    setBusy(true)
    setError(null)
    try {
      setPayload(await openShare(parsed.envelope, passphrase || undefined))
      setPassphrase('')
    } catch (err) {
      setPassphrase('')
      if (err instanceof ShareExpiredError) {
        setExpiredAt(err.expiredAt)
      } else {
        setError(
          err instanceof VaultDecryptError && parsed.needsPassphrase
            ? 'Wrong passphrase, or the link is damaged.'
            : 'This link is damaged and cannot be opened.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  const copy = () => {
    if (!payload) return
    void copyText(payload.secret).then((ok) =>
      toast(ok ? 'Secret copied' : 'Could not access the clipboard', ok ? 'info' : 'error'),
    )
  }

  return (
    <Dialog open={parsed !== null} title="A secret was shared with you" onClose={close}>
      {expiredAt !== null ? (
        <div className="vault-form">
          <p className="vault__locked-hint" role="alert">
            This link expired on {new Date(expiredAt).toLocaleString()} and the secret can no
            longer be revealed.
          </p>
          <div className="dialog__actions">
            <Button onClick={close}>Close</Button>
          </div>
        </div>
      ) : !payload ? (
        <form onSubmit={reveal} className="vault-form">
          <p className="vault__locked-hint">
            This link carries an encrypted secret. It is decrypted here, on your device only.
          </p>
          {parsed?.needsPassphrase && (
            <PasswordInput
              label="Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              hint="The sender gave you this passphrase separately."
              error={error ?? undefined}
              autoFocus
            />
          )}
          {!parsed?.needsPassphrase && error && <p className="field__error" role="alert">{error}</p>}
          <div className="dialog__actions">
            <Button onClick={close}>Dismiss</Button>
            <Button type="submit" variant="primary" busy={busy} disabled={parsed?.needsPassphrase ? !passphrase : false}>
              Reveal secret
            </Button>
          </div>
        </form>
      ) : (
        <div className="vault-form">
          {payload.label && <p className="field__label">{payload.label}</p>}
          <p className="share__secret">{payload.secret}</p>
          <div className="dialog__actions">
            <Button onClick={close}>Close</Button>
            <Button variant="primary" onClick={copy}>
              Copy secret
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
