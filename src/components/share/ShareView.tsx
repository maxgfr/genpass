import { useId, useState, type FormEvent } from 'react'
import '../../styles/share.css'
import { copyText } from '../../lib/clipboard'
import { buildShareUrl, createShareFragment } from '../../lib/share'
import { useToasts } from '../../state/useToasts'
import { Button } from '../ui/Button'
import { InlineWarning } from '../ui/InlineWarning'
import { Segmented } from '../ui/Segmented'
import { PasswordInput, TextInput } from '../ui/TextInput'
import { QrCode, qrPngBlob, qrSvgDocument } from './QrCode'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface ShareViewProps {
  /** Secret handed over by a share button elsewhere in the app. */
  prefill?: string | null
}

export function ShareView({ prefill }: ShareViewProps) {
  const { toast } = useToasts()
  const textareaId = useId()
  const [mode, setMode] = useState<'link' | 'qr'>(prefill ? 'link' : 'qr')
  const [text, setText] = useState(prefill ?? '')
  const [label, setLabel] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const createLink = async (e: FormEvent) => {
    e.preventDefault()
    if (!text) return
    setBusy(true)
    try {
      const fragment = await createShareFragment(
        { secret: text, label: label.trim() || undefined },
        passphrase || null,
      )
      setLink(buildShareUrl(fragment))
    } finally {
      setBusy(false)
    }
  }

  const copyLink = () => {
    if (!link) return
    void copyText(link).then((ok) => toast(ok ? 'Link copied' : 'Could not access the clipboard', ok ? 'info' : 'error'))
  }

  return (
    <>
      <div className="gen__controls">
        <Segmented
          label="Share mode"
          value={mode}
          onChange={(next) => {
            setMode(next)
            setLink(null)
          }}
          options={[
            { value: 'qr', label: 'QR code' },
            { value: 'link', label: 'Encrypted link' },
          ]}
        />
      </div>

      <section className="panel">
        <div className="field">
          <label className="field__label" htmlFor={textareaId}>
            {mode === 'qr' ? 'Text' : 'Secret'}
          </label>
          <textarea
            id={textareaId}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setLink(null)
            }}
            placeholder={mode === 'qr' ? 'Any text, URL, or Wi-Fi code…' : 'The password or secret to share…'}
            spellCheck={false}
          />
        </div>

        {mode === 'qr' && text && (
          <>
            <QrCode text={text} label={`QR code for the entered text`} />
            <div className="share__downloads">
              <Button
                small
                onClick={() =>
                  download(new Blob([qrSvgDocument(text)], { type: 'image/svg+xml' }), 'genpass-qr.svg')
                }
              >
                Download SVG
              </Button>
              <Button small onClick={() => void qrPngBlob(text).then((b) => download(b, 'genpass-qr.png'))}>
                Download PNG
              </Button>
            </div>
            <p className="vault__locked-hint">
              Generated locally — the text never leaves this device.
            </p>
          </>
        )}

        {mode === 'link' && (
          <form onSubmit={createLink} className="app__view" style={{ marginTop: 0 }}>
            <TextInput
              label="Label (optional)"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value)
                setLink(null)
              }}
              placeholder="e.g. Wi-Fi password"
            />
            <PasswordInput
              label="Passphrase (optional, recommended)"
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.target.value)
                setLink(null)
              }}
              hint="With a passphrase, the link alone is useless — tell the recipient the passphrase over a different channel."
            />
            <Button type="submit" variant="primary" busy={busy} disabled={!text}>
              Create encrypted link
            </Button>
          </form>
        )}

        {mode === 'link' && link && (
          <>
            <div className="share__link-row">
              <input readOnly value={link} aria-label="Share link" onFocus={(e) => e.target.select()} />
              <Button onClick={copyLink}>Copy link</Button>
            </div>
            <QrCode text={link} label="QR code for the share link" />
            <InlineWarning>
              The encrypted secret lives inside this link — there is no server, no expiry, and no
              one-time view. Anyone with the link{passphrase ? ' and the passphrase' : ''} can read
              it, and it stays in browser history. Send it over a private channel.
            </InlineWarning>
          </>
        )}
      </section>
    </>
  )
}
