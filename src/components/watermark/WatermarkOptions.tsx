import { useId } from 'react'
import {
  ANGLE_RANGE,
  OPACITY_RANGE,
  SCALE_RANGE,
  type WatermarkConfig,
} from '../../lib/watermark'
import { Segmented } from '../ui/Segmented'
import { Slider } from '../ui/Slider'
import { TextInput } from '../ui/TextInput'

interface WatermarkOptionsProps {
  value: WatermarkConfig
  onChange: (next: WatermarkConfig) => void
}

/**
 * The sliders speak whole numbers — percent and degrees — the way the
 * generator's length slider does; the 0..1 config values are derived here so
 * nothing downstream has to think about the UI's units.
 */
export function WatermarkOptions({ value, onChange }: WatermarkOptionsProps) {
  const colourId = useId()
  const set = (changes: Partial<WatermarkConfig>) => onChange({ ...value, ...changes })

  return (
    <>
      <TextInput
        label="Watermark text"
        value={value.text}
        onChange={(e) => set({ text: e.target.value })}
        placeholder="CONFIDENTIAL"
        spellCheck={false}
        maxLength={80}
      />

      <Segmented
        label="Pattern"
        value={value.layout}
        onChange={(layout) => set({ layout })}
        options={[
          { value: 'tiled', label: 'Tiled' },
          { value: 'single', label: 'Once, centred' },
        ]}
      />

      <Slider
        label="Size"
        value={Math.round(value.scale * 100)}
        min={Math.round(SCALE_RANGE.min * 100)}
        max={Math.round(SCALE_RANGE.max * 100)}
        onChange={(percent) => set({ scale: percent / 100 })}
        format={(percent) => `${percent}% of the page`}
      />

      <Slider
        label="Opacity"
        value={Math.round(value.opacity * 100)}
        min={Math.round(OPACITY_RANGE.min * 100)}
        max={Math.round(OPACITY_RANGE.max * 100)}
        onChange={(percent) => set({ opacity: percent / 100 })}
        format={(percent) => `${percent}%`}
      />

      <Slider
        label="Angle"
        value={Math.round(value.angleDeg)}
        min={ANGLE_RANGE.min}
        max={ANGLE_RANGE.max}
        onChange={(angleDeg) => set({ angleDeg })}
        format={(angle) => `${angle}°`}
      />

      <div className="field">
        <label className="field__label" htmlFor={colourId}>
          Colour
        </label>
        <div className="wm__colour">
          <input
            id={colourId}
            type="color"
            value={value.color}
            onChange={(e) => set({ color: e.target.value })}
          />
          {/* The swatch alone tells a colour-blind user nothing; the hex does. */}
          <span className="wm__colour-value">{value.color.toUpperCase()}</span>
        </div>
      </div>
    </>
  )
}
