import { useEffect, useState } from 'react'
import { copyWithAutoClear } from '../../lib/clipboard'
import type { VaultEntry } from '../../lib/vaultFormat'
import { useSettings } from '../../state/SettingsProvider'
import { useToasts } from '../../state/useToasts'
import { useVault } from '../../state/VaultProvider'
import { Button, IconButton } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon, ShareIcon, TrashIcon } from '../ui/icons'

const REVEAL_HIDE_MS = 10_000

interface EntryRowProps {
  entry: VaultEntry
  onShare?: (password: string) => void
}

export function EntryRow({ entry, onShare }: EntryRowProps) {
  const { deleteEntry } = useVault()
  const { settings } = useSettings()
  const { toast } = useToasts()
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Auto-hide a revealed password.
  useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => setRevealed(false), REVEAL_HIDE_MS)
    return () => clearTimeout(timer)
  }, [revealed])

  const copy = () => {
    const { done } = copyWithAutoClear(entry.password, settings.clipboardClearSeconds * 1000)
    void done.then((ok) => {
      if (!ok) {
        toast('Could not access the clipboard', 'error')
        return
      }
      setCopied(true)
      toast(
        settings.clipboardClearSeconds > 0
          ? `Copied — clipboard clears in ${settings.clipboardClearSeconds}s`
          : 'Copied to clipboard',
      )
      setTimeout(() => setCopied(false), 1_600)
    })
  }

  const meta = [entry.site, entry.username].filter(Boolean).join(' · ')

  return (
    <li className="entry">
      <div className="entry__main">
        <span className="entry__label">{entry.label}</span>
        {meta && <span className="entry__meta">{meta}</span>}
        {revealed && <code className="entry__password">{entry.password}</code>}
      </div>
      <span className="entry__actions">
        <IconButton
          label={revealed ? 'Hide password' : 'Show password'}
          onClick={() => setRevealed((r) => !r)}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </IconButton>
        <IconButton label={copied ? 'Copied' : 'Copy password'} onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </IconButton>
        {onShare && (
          <IconButton label={`Share ${entry.label}`} onClick={() => onShare(entry.password)}>
            <ShareIcon />
          </IconButton>
        )}
        <IconButton label={`Delete ${entry.label}`} onClick={() => setConfirmingDelete(true)}>
          <TrashIcon />
        </IconButton>
      </span>

      <Dialog open={confirmingDelete} title={`Delete “${entry.label}”?`} onClose={() => setConfirmingDelete(false)}>
        <p>This permanently removes the entry from your vault.</p>
        <div className="dialog__actions">
          <Button onClick={() => setConfirmingDelete(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              void deleteEntry(entry.id).then(() => toast(`Deleted ${entry.label}`))
              setConfirmingDelete(false)
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </li>
  )
}
