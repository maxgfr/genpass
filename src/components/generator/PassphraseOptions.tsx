import type { PassphraseSeparator } from '../../lib/passphrase'
import { WORD_COUNT_MAX, WORD_COUNT_MIN, type PassphraseSettings } from '../../lib/settings'
import { Select } from '../ui/Select'
import { Slider } from '../ui/Slider'
import { Toggle } from '../ui/Toggle'

const SEPARATORS: { value: PassphraseSeparator; label: string }[] = [
  { value: '-', label: 'Hyphen (-)' },
  { value: ' ', label: 'Space' },
  { value: '.', label: 'Period (.)' },
  { value: '_', label: 'Underscore (_)' },
  { value: '', label: 'None' },
]

interface PassphraseOptionsProps {
  value: PassphraseSettings
  onChange: (patch: Partial<PassphraseSettings>) => void
}

/** Controlled options block, reused by GeneratorView and SettingsView. */
export function PassphraseOptions({ value, onChange }: PassphraseOptionsProps) {
  return (
    <>
      <Slider
        label="Words"
        min={WORD_COUNT_MIN}
        max={WORD_COUNT_MAX}
        value={value.wordCount}
        onChange={(wordCount) => onChange({ wordCount })}
        format={(v) => `${v} words`}
      />
      <Select
        label="Separator"
        value={value.separator}
        onChange={(e) => onChange({ separator: e.target.value as PassphraseSeparator })}
      >
        {SEPARATORS.map((s) => (
          <option key={s.label} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      <div className="gen__toggles">
        <Toggle checked={value.capitalize} onChange={(capitalize) => onChange({ capitalize })}>
          Capitalize words
        </Toggle>
        <Toggle checked={value.includeDigit} onChange={(includeDigit) => onChange({ includeDigit })}>
          Add a digit
        </Toggle>
      </div>
    </>
  )
}
