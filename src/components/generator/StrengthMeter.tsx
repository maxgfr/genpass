import { crackTimeSeconds, formatCrackTime, strengthFromBits } from '../../lib/entropy'

/** One meter per batch: identical options mean identical entropy. */
export function StrengthMeter({ bits }: { bits: number }) {
  const label = strengthFromBits(bits)
  const crack = formatCrackTime(crackTimeSeconds(bits))
  const width = `${Math.min(100, Math.round(bits))}%`
  return (
    <div className="strength">
      <div className="strength__bar" role="presentation">
        <div className="strength__fill" data-level={label} style={{ width }} />
      </div>
      <p className="strength__meta">
        <span className="strength__label">{label}</span> · {Math.round(bits)} bits ·{' '}
        {crack === 'instant' ? 'cracked instantly' : `${crack} to crack`} at 10¹⁰ guesses/s (offline attack)
      </p>
    </div>
  )
}
