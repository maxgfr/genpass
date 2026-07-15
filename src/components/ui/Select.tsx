import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'> {
  label: string
  hint?: string
  children: ReactNode
}

export function Select({ label, hint, children, ...rest }: SelectProps) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <select id={id} aria-describedby={hint ? hintId : undefined} {...rest}>
          {children}
        </select>
      </div>
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
}
