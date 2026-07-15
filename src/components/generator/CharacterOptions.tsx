import { dedupeExclusions, type CharClass } from '../../lib/charset'
import { LENGTH_MAX, LENGTH_MIN, type GeneratorSettings } from '../../lib/settings'
import { Slider } from '../ui/Slider'
import { TextInput } from '../ui/TextInput'
import { Toggle } from '../ui/Toggle'

export const CLASS_LABELS: Record<CharClass, string> = {
  uppercase: 'Uppercase (A–Z)',
  lowercase: 'Lowercase (a–z)',
  digits: 'Digits (0–9)',
  symbols: 'Symbols (@&$!#?)',
}

export type CharacterOptionsValue = Pick<
  GeneratorSettings,
  'length' | 'uppercase' | 'lowercase' | 'digits' | 'symbols' | 'excludeSimilar' | 'excludeCustom'
>

interface CharacterOptionsProps {
  value: CharacterOptionsValue
  onChange: (patch: Partial<CharacterOptionsValue>) => void
}

/** Controlled options block, reused by GeneratorView and SettingsView. */
export function CharacterOptions({ value, onChange }: CharacterOptionsProps) {
  return (
    <>
      <Slider
        label="Length"
        min={LENGTH_MIN}
        max={LENGTH_MAX}
        value={value.length}
        onChange={(length) => onChange({ length })}
        format={(v) => `${v} characters`}
      />
      <div className="gen__toggles">
        {(Object.keys(CLASS_LABELS) as CharClass[]).map((cls) => (
          <Toggle key={cls} checked={value[cls]} onChange={(checked) => onChange({ [cls]: checked })}>
            {CLASS_LABELS[cls]}
          </Toggle>
        ))}
        <Toggle
          checked={value.excludeSimilar}
          onChange={(excludeSimilar) => onChange({ excludeSimilar })}
        >
          Exclude similar (0O 1l| 2Z 5S 8B)
        </Toggle>
      </div>
      <TextInput
        label="Exclude characters"
        value={value.excludeCustom}
        onChange={(e) => onChange({ excludeCustom: dedupeExclusions(e.target.value) })}
        placeholder="e.g. @$aeiou"
        autoComplete="off"
        spellCheck={false}
        hint="These exact characters will never appear in generated passwords."
      />
    </>
  )
}
