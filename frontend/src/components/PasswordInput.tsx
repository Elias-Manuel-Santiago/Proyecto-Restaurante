import { useId, useState, type Ref } from 'react'
import { Icon } from './Icon'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  inputRef?: Ref<HTMLInputElement>
  autoComplete?: 'off' | 'new-password'
}

export function PasswordInput({
  label,
  value,
  onChange,
  error,
  inputRef,
  autoComplete = 'off',
}: Props) {
  const inputId = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="login-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="password-field">
        <input
          ref={inputRef}
          id={inputId}
          type={visible ? 'text' : 'password'}
          required
          maxLength={128}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="password-toggle"
          type="button"
          aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
          aria-controls={inputId}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} />
          <span>{visible ? 'Ocultar' : 'Mostrar'}</span>
        </button>
      </div>
      {error && (
        <p id={`${inputId}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
