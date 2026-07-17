import { useState } from 'react'
import { useSettings } from '../../state/SettingsProvider'
import { useToasts } from '../../state/useToasts'
import { useVault } from '../../state/VaultProvider'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { InlineWarning } from '../ui/InlineWarning'
import { Segmented } from '../ui/Segmented'
import { Select } from '../ui/Select'
import { CharacterOptions } from '../generator/CharacterOptions'
import { PassphraseOptions } from '../generator/PassphraseOptions'

export function SettingsView() {
  const { settings, update } = useSettings()
  const vault = useVault()
  const { toast } = useToasts()
  const [erasing, setErasing] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  const entryCount = vault.state.status === 'unlocked' ? vault.state.entries.length : null
  const nothingToErase = vault.state.status === 'uninitialized' && !vault.corrupt

  const closeErase = () => {
    setErasing(false)
    setAcknowledged(false)
  }

  const confirmErase = () => {
    vault.eraseVault()
    closeErase()
    toast('Vault erased')
  }

  return (
    <>
      <section className="panel" aria-label="Appearance">
        <h2 className="panel__title">Appearance</h2>
        <Segmented
          label="Theme"
          value={settings.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'auto', label: 'Auto' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </section>

      <section className="panel" aria-label="Security">
        <h2 className="panel__title">Security</h2>
        <Select
          label="Auto-lock the vault after"
          value={settings.autoLockMinutes}
          onChange={(e) => update({ autoLockMinutes: Number(e.target.value) as 1 | 5 | 15 | 30 })}
        >
          <option value={1}>1 minute</option>
          <option value={5}>5 minutes</option>
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
        </Select>
        <Select
          label="Clear clipboard after copying"
          value={settings.clipboardClearSeconds}
          onChange={(e) => update({ clipboardClearSeconds: Number(e.target.value) as 0 | 15 | 30 | 60 })}
          hint="Best-effort: the browser may block clearing while the tab is unfocused."
        >
          <option value={0}>Never</option>
          <option value={15}>15 seconds</option>
          <option value={30}>30 seconds</option>
          <option value={60}>60 seconds</option>
        </Select>
      </section>

      <section className="panel" aria-label="Generator defaults">
        <h2 className="panel__title">Generator defaults</h2>
        <div className="gen__controls">
          <Segmented
            label="Default mode"
            value={settings.generator.mode}
            onChange={(mode) => update({ generator: { ...settings.generator, mode } })}
            options={[
              { value: 'characters', label: 'Characters' },
              { value: 'passphrase', label: 'Passphrase' },
            ]}
          />
          <Segmented
            label="Default batch size"
            value={settings.generator.batchSize}
            onChange={(batchSize) => update({ generator: { ...settings.generator, batchSize } })}
            options={[
              { value: 1, label: '×1' },
              { value: 10, label: '×10' },
            ]}
          />
        </div>
        <CharacterOptions
          value={settings.generator}
          onChange={(patch) => update({ generator: { ...settings.generator, ...patch } })}
        />
      </section>

      <section className="panel" aria-label="Passphrase defaults">
        <h2 className="panel__title">Passphrase defaults</h2>
        <PassphraseOptions
          value={settings.passphrase}
          onChange={(patch) => update({ passphrase: { ...settings.passphrase, ...patch } })}
        />
      </section>

      <section className="panel panel--plain" aria-label="How your data is stored">
        <h2 className="panel__title">How your data is stored</h2>
        <p className="vault__locked-hint">
          Everything happens in your browser. Generated passwords never leave this device; the app
          makes no network requests and works fully offline. The vault is stored locally, encrypted
          with AES-256-GCM using a key derived from your master password (PBKDF2, 1,000,000
          iterations). Nobody — including this site — can read it without that password, and there
          is no recovery if you forget it. Settings on this page are stored unencrypted; passwords
          never are.
        </p>
      </section>

      <section className="panel" aria-label="Reset">
        <h2 className="panel__title">Reset</h2>
        <p className="vault__locked-hint">
          There is no password recovery: the vault is encrypted and nobody — including this app —
          can open it without the master password. If you have forgotten it, the only way forward
          is to erase the vault and start over. A backup exported earlier stays readable with the
          password it had when exported.
        </p>
        <div>
          <Button variant="danger" small onClick={() => setErasing(true)} disabled={nothingToErase}>
            Erase vault…
          </Button>
        </div>
        <Dialog open={erasing} title="Erase the vault" onClose={closeErase}>
          <form
            className="vault-form"
            onSubmit={(e) => {
              e.preventDefault()
              confirmErase()
            }}
          >
            <InlineWarning danger>
              This permanently deletes the encrypted vault
              {entryCount !== null && entryCount > 0
                ? ` and the ${entryCount} ${entryCount === 1 ? 'password' : 'passwords'} saved in it`
                : ' and every password saved in it'}
              . There is no undo and nothing can be recovered afterwards.
            </InlineWarning>
            <label className="vault-form__ack">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              I understand every saved password will be permanently deleted.
            </label>
            <div className="dialog__actions">
              <Button onClick={closeErase}>Cancel</Button>
              <Button type="submit" variant="danger" disabled={!acknowledged}>
                Erase vault forever
              </Button>
            </div>
          </form>
        </Dialog>
      </section>
    </>
  )
}
