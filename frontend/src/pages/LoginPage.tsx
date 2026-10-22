import { useRef, useState, type FormEvent } from 'react'
import { PasswordInput } from '../components/PasswordInput'
import { useRestaurant } from '../state/useRestaurant'

export function LoginPage({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<string>
}) {
  const { warning } = useRestaurant()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current) return
    if (!username.trim() || !password) {
      setError('Completá usuario y contraseña.')
      return
    }
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const message = await onLogin(username.trim(), password)
      setError(message)
      if (!message) setPassword('')
    } catch {
      setError('No se pudo iniciar sesión. Volvé a intentarlo.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="brand-mark">N</span>
          <p>
            NÁCAR <small>RESTAURANTE</small>
          </p>
        </div>
        <div>
          <span className="eyebrow">Tu espacio en el restaurante</span>
          <h1 id="login-title">Bienvenido a NÁCAR</h1>
          <p className="muted">
            Ingresá con la cuenta que te asignó el administrador.
          </p>
        </div>
        <form onSubmit={submit} aria-busy={busy}>
          <fieldset className="form-fieldset" disabled={busy}>
            <div className="login-field">
              <label htmlFor="login-username">Usuario</label>
              <input
                autoFocus
                id="login-username"
                name="username"
                required
                maxLength={40}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setError('')
                }}
              />
            </div>
            <PasswordInput
              label="Contraseña"
              value={password}
              autoComplete="current-password"
              onChange={(value) => {
                setPassword(value)
                setError('')
              }}
            />
            {(error || warning) && (
              <p className="form-error" role="alert">
                {error || warning}
              </p>
            )}
            <button className="primary-button" type="submit">
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
          </fieldset>
        </form>
        <p className="login-note">
          ¿Necesitás una cuenta o recuperar el acceso? Consultá al
          administrador.
        </p>
      </section>
      <aside className="login-aside">
        <div>
          <span className="eyebrow">NÁCAR Restaurante</span>
          <h2>
            La mesa reúne.
            <br />
            El detalle distingue.
          </h2>
          <p>Salón, cocina y reparto, al mismo ritmo.</p>
        </div>
      </aside>
    </main>
  )
}
