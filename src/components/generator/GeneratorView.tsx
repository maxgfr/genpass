import { useCallback, useEffect, useMemo, useState } from 'react'
import '../../styles/generator.css'
import { analyzePool } from '../../lib/charset'
import { copyWithAutoClear } from '../../lib/clipboard'
import { passphraseEntropyBits, passwordEntropyBits } from '../../lib/entropy'
import { generatePasswords } from '../../lib/generator'
import { generatePassphrase } from '../../lib/passphrase'
import type { PassphraseSettings } from '../../lib/settings'
import { getWordlist } from '../../lib/wordlist'
import { useSettings } from '../../state/SettingsProvider'
import { useToasts } from '../../state/useToasts'
import { Button, IconButton } from '../ui/Button'
import { InlineWarning } from '../ui/InlineWarning'
import { Segmented } from '../ui/Segmented'
import { CheckIcon, CopyIcon, RefreshIcon, SaveIcon, ShareIcon } from '../ui/icons'
import { CharacterOptions, CLASS_LABELS, type CharacterOptionsValue } from './CharacterOptions'
import { PassphraseOptions } from './PassphraseOptions'
import { StrengthMeter } from './StrengthMeter'

interface GeneratorViewProps {
  /** Wired by the app to open the save-to-vault dialog. */
  onSave?: (password: string) => void
  /** Wired by the app to open the Share & QR tab with this password. */
  onShare?: (password: string) => void
}

export function GeneratorView({ onSave, onShare }: GeneratorViewProps) {
  const { settings } = useSettings()
  const { toast } = useToasts()

  const [mode, setMode] = useState<'characters' | 'passphrase'>(settings.generator.mode)
  const [batchSize, setBatchSize] = useState<1 | 10>(settings.generator.batchSize)
  const [charOpts, setCharOpts] = useState<CharacterOptionsValue>(() => ({
    length: settings.generator.length,
    uppercase: settings.generator.uppercase,
    lowercase: settings.generator.lowercase,
    digits: settings.generator.digits,
    symbols: settings.generator.symbols,
    excludeSimilar: settings.generator.excludeSimilar,
    excludeCustom: settings.generator.excludeCustom,
  }))
  const [passOpts, setPassOpts] = useState<PassphraseSettings>(() => ({ ...settings.passphrase }))
  const [results, setResults] = useState<string[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const analysis = useMemo(() => analyzePool({ ...charOpts }), [charOpts])

  const bits =
    mode === 'characters'
      ? passwordEntropyBits(charOpts.length, analysis.pool.length)
      : passphraseEntropyBits({ wordCount: passOpts.wordCount, includeDigit: passOpts.includeDigit })

  const regenerate = useCallback(() => {
    setCopiedIndex(null)
    if (mode === 'characters') {
      if (analysis.poolEmpty) {
        setResults([])
        return
      }
      setResults(generatePasswords({ ...charOpts }, batchSize))
    } else {
      const wordlist = getWordlist()
      setResults(Array.from({ length: batchSize }, () => generatePassphrase(passOpts, wordlist)))
    }
  }, [mode, batchSize, charOpts, passOpts, analysis.poolEmpty])

  useEffect(() => {
    regenerate()
  }, [regenerate])

  const copy = (password: string, index: number) => {
    // writeText fires synchronously inside the click gesture (Safari).
    const clearMs = settings.clipboardClearSeconds * 1000
    const { done } = copyWithAutoClear(password, clearMs)
    void done.then((ok) => {
      if (!ok) {
        toast('Could not access the clipboard', 'error')
        return
      }
      setCopiedIndex(index)
      toast(
        settings.clipboardClearSeconds > 0
          ? `Copied — clipboard clears in ${settings.clipboardClearSeconds}s`
          : 'Copied to clipboard',
      )
      setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1_600)
    })
  }

  return (
    <>
      <div className="gen__controls">
        <Segmented
          label="Generation mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'characters', label: 'Characters' },
            { value: 'passphrase', label: 'Passphrase' },
          ]}
        />
        <div className="gen__controls">
          <Segmented
            label="How many passwords"
            value={batchSize}
            onChange={setBatchSize}
            options={[
              { value: 1, label: '×1' },
              { value: 10, label: '×10' },
            ]}
          />
          <Button onClick={regenerate} disabled={mode === 'characters' && analysis.poolEmpty}>
            <RefreshIcon size={16} />
            Regenerate
          </Button>
        </div>
      </div>

      {mode === 'characters' && analysis.noClassSelected && (
        <InlineWarning danger>Select at least one character class to generate passwords.</InlineWarning>
      )}
      {mode === 'characters' && !analysis.noClassSelected && analysis.poolEmpty && (
        <InlineWarning danger>
          Every character has been excluded — remove some exclusions to generate passwords.
        </InlineWarning>
      )}
      {mode === 'characters' && !analysis.poolEmpty && analysis.emptiedClasses.length > 0 && (
        <InlineWarning>
          {analysis.emptiedClasses.map((c) => CLASS_LABELS[c].split(' ')[0]).join(', ')}{' '}
          {analysis.emptiedClasses.length === 1 ? 'is' : 'are'} fully excluded — passwords are no longer
          guaranteed to contain one.
        </InlineWarning>
      )}

      {results.length > 0 && (
        <>
          <ul className={results.length === 1 ? 'gen__results gen__results--single' : 'gen__results'}>
            {results.map((password, index) => (
              <li key={`${index}-${password}`} className="gen__result">
                <code className="gen__password" data-testid="password">
                  {password}
                </code>
                <span className="gen__result-actions">
                  <IconButton
                    label={copiedIndex === index ? 'Copied' : 'Copy'}
                    onClick={() => copy(password, index)}
                  >
                    {copiedIndex === index ? <CheckIcon /> : <CopyIcon />}
                  </IconButton>
                  {onSave && (
                    <IconButton label="Save to vault" onClick={() => onSave(password)}>
                      <SaveIcon />
                    </IconButton>
                  )}
                  {onShare && (
                    <IconButton label="Share or show QR" onClick={() => onShare(password)}>
                      <ShareIcon />
                    </IconButton>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <StrengthMeter bits={bits} />
        </>
      )}

      <section className="panel" aria-label="Options">
        <h2 className="panel__title">Options</h2>
        {mode === 'characters' ? (
          <CharacterOptions value={charOpts} onChange={(patch) => setCharOpts((v) => ({ ...v, ...patch }))} />
        ) : (
          <PassphraseOptions value={passOpts} onChange={(patch) => setPassOpts((v) => ({ ...v, ...patch }))} />
        )}
      </section>
    </>
  )
}
