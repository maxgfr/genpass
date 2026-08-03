import { PIN_LENGTH_MAX, PIN_LENGTH_MIN, type PinSettings } from '../../lib/settings'
import { Slider } from '../ui/Slider'

interface PinOptionsProps {
  value: PinSettings
  onChange: (patch: Partial<PinSettings>) => void
}

/** Controlled options block, reused by GeneratorView and SettingsView.
 *  Labelled "Digits" rather than "PIN length": SettingsView renders every
 *  options block at once, and a second slider matching /length/i would make
 *  the character-mode one ambiguous to query. */
export function PinOptions({ value, onChange }: PinOptionsProps) {
  return (
    <Slider
      label="Digits"
      min={PIN_LENGTH_MIN}
      max={PIN_LENGTH_MAX}
      value={value.length}
      onChange={(length) => onChange({ length })}
      format={(v) => `${v} digits`}
    />
  )
}
