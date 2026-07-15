import { useId, useState, type InputHTMLAttributes } from 'react'
import { IconButton } from './Button'
import { EyeIcon, EyeOffIcon } from './icons'

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string
  hint?: string
  error?: string
}

export function TextInput({ label, hint, error, ...rest }: TextInputProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <div className={['field', error && 'field--invalid'].filter(Boolean).join(' ')}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <input id={id} aria-describedby={error ? errorId : hint ? hintId : undefined} aria-invalid={error ? true : undefined} {...rest} />
      </div>
      {hint && !error && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

interface PasswordInputProps extends Omit<TextInputProps, 'type'> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

/** Text input with a reveal toggle, for master-password fields. */
export function PasswordInput({ label, hint, error, value, onChange, ...rest }: PasswordInputProps) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <div className={['field', error && 'field--invalid'].filter(Boolean).join(' ')}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <input
          id={id}
          type={revealed ? 'text' : 'password'}
          className="has-reveal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={onChange}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        <span className="field__reveal">
          <IconButton label={revealed ? 'Hide password' : 'Show password'} onClick={() => setRevealed((r) => !r)}>
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </IconButton>
        </span>
      </div>
      {hint && !error && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
