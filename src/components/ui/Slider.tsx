import { useId } from 'react'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  /** Optional formatter for the displayed value (e.g. "20 characters"). */
  format?: (value: number) => string
}

export function Slider({ label, value, min, max, onChange, format }: SliderProps) {
  const id = useId()
  return (
    <div className="slider">
      <div className="slider__head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="slider__value">
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
