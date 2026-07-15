import { useRef, useState, type FormEvent } from 'react'
import { VaultDecryptError } from '../../lib/vaultCrypto'
import { VaultFormatError } from '../../lib/vaultFormat'
import { useToasts } from '../../state/useToasts'
import { useVault } from '../../state/VaultProvider'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { InlineWarning } from '../ui/InlineWarning'
import { PasswordInput } from '../ui/TextInput'
import { DownloadIcon, KeyIcon, UploadIcon } from '../ui/icons'

function exportFilename(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `genpass-vault-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}

export function VaultToolbarExtras() {
  const vault = useVault()
  const { toast } = useToasts()
  const fileInput = useRef<HTMLInputElement>(null)

  const [importFile, setImportFile] = useState<string | null>(null)
  const [importPassword, setImportPassword] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importBusy, setImportBusy] = useState(false)

  const [changing, setChanging] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changeError, setChangeError] = useState<string | null>(null)
  const [changeBusy, setChangeBusy] = useState(false)

  const entryCount = vault.state.status === 'unlocked' ? vault.state.entries.length : 0

  const exportVault = () => {
    const blob = vault.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = exportFilename()
    a.click()
    URL.revokeObjectURL(url)
    toast('Encrypted vault downloaded')
  }

  const onFilePicked = async (file: File | undefined) => {
    if (!file) return
    setImportError(null)
    setImportPassword('')
    setImportFile(await file.text())
  }

  const confirmImport = async (e: FormEvent) => {
    e.preventDefault()
    if (importFile === null) return
    setImportBusy(true)
    setImportError(null)
    try {
      await vault.importReplace(importFile, importPassword)
      setImportFile(null)
      setImportPassword('')
      toast('Vault imported')
    } catch (err) {
      if (err instanceof VaultFormatError) setImportError('This file is not a genpass vault export.')
      else if (err instanceof VaultDecryptError)
        setImportError('Wrong master password for this file, or the file is corrupted.')
      else setImportError('Could not import the file.')
    } finally {
      setImportBusy(false)
    }
  }

  const closeChange = () => {
    setChanging(false)
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setChangeError(null)
  }

  const confirmChange = async (e: FormEvent) => {
    e.preventDefault()
    if (newPw.length < 10) {
      setChangeError('Use at least 10 characters.')
      return
    }
    if (newPw !== confirmPw) {
      setChangeError('The new passwords do not match.')
      return
    }
    setChangeBusy(true)
    setChangeError(null)
    try {
      await vault.changeMasterPassword(currentPw, newPw)
      closeChange()
      toast('Master password changed')
    } catch (err) {
      setChangeError(
        err instanceof VaultDecryptError ? 'The current master password is wrong.' : 'Could not change the password.',
      )
    } finally {
      setChangeBusy(false)
    }
  }

  return (
    <>
      <Button small onClick={exportVault}>
        <DownloadIcon size={14} />
        Export
      </Button>
      <Button small onClick={() => fileInput.current?.click()}>
        <UploadIcon size={14} />
        Import
      </Button>
      <Button small onClick={() => setChanging(true)}>
        <KeyIcon size={14} />
        Change password
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label="Import vault file"
        onChange={(e) => {
          void onFilePicked(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <Dialog open={importFile !== null} title="Import vault" onClose={() => setImportFile(null)}>
        <form onSubmit={confirmImport} className="vault-form">
          <InlineWarning danger>
            Importing replaces your current vault
            {entryCount > 0
              ? ` — your ${entryCount} existing ${entryCount === 1 ? 'entry' : 'entries'} will be deleted.`
              : '.'}{' '}
            The imported file's master password becomes your master password.
          </InlineWarning>
          <PasswordInput
            label="Master password of the imported file"
            value={importPassword}
            onChange={(e) => setImportPassword(e.target.value)}
            error={importError ?? undefined}
            autoFocus
          />
          <div className="dialog__actions">
            <Button onClick={() => setImportFile(null)}>Cancel</Button>
            <Button type="submit" variant="danger" busy={importBusy} disabled={!importPassword}>
              Replace vault
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={changing} title="Change master password" onClose={closeChange}>
        <form onSubmit={confirmChange} className="vault-form">
          <PasswordInput
            label="Current master password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          <PasswordInput
            label="New master password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            hint="At least 10 characters."
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm new master password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            error={changeError ?? undefined}
            autoComplete="new-password"
          />
          <div className="dialog__actions">
            <Button onClick={closeChange}>Cancel</Button>
            <Button type="submit" variant="primary" busy={changeBusy} disabled={!currentPw || !newPw}>
              Confirm new password
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
