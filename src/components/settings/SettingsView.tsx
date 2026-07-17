import { useSettings } from '../../state/SettingsProvider'
import { Segmented } from '../ui/Segmented'
import { Select } from '../ui/Select'
import { CharacterOptions } from '../generator/CharacterOptions'
import { PassphraseOptions } from '../generator/PassphraseOptions'

export function SettingsView() {
  const { settings, update } = useSettings()

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
    </>
  )
}
