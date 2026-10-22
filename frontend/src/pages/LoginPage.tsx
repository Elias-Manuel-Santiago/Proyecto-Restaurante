import { useEffect, useRef, useState, type FormEvent } from 'react'
import { roleLabels, type Role } from '../types'
import { useRestaurant } from '../state/useRestaurant'
import { Icon } from '../components/Icon'
import { PasswordInput } from '../components/PasswordInput'

const roles: Role[] = ['mozo', 'chef', 'admin', 'repartidor']
const roleDescriptions: Record<Role, string> = {
  mozo: 'Mesas, pedidos y entrega',
  chef: 'Comandas y disponibilidad',
  admin: 'Resumen, carta y equipo',
  repartidor: 'Vista de entregas y demostración',
}

export function LoginPage({ onLogin }: { onLogin: (role: Role) => string }) {
  const { data, warning } = useRestaurant()
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const usernameInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const roleButtons = useRef<Partial<Record<Role, HTMLButtonElement | null>>>(
    {},
  )
  const lastRole = useRef<Role>('mozo')
  const usernameError = submitted && !username.trim()
  const passwordError = submitted && !password.trim()

  useEffect(() => {
    if (selectedRole) usernameInput.current?.focus()
    else roleButtons.current[lastRole.current]?.focus()
  }, [selectedRole])

  const chooseRole = (role: Role | null) => {
    if (role) lastRole.current = role
    setUsername('')
    setPassword('')
    setSubmitted(false)
    setError('')
    setSelectedRole(role)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setError('')
    if (!username.trim()) {
      usernameInput.current?.focus()
      return
    }
    if (!password.trim()) {
      passwordInput.current?.focus()
      return
    }
    if (!selectedRole) return
    try {
      const message = onLogin(selectedRole)
      if (message) setError(message)
      else {
        setUsername('')
        setPassword('')
      }
    } catch {
      setError('No se pudo iniciar sesión. Volvé a intentarlo.')
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
          <span className="eyebrow">
            Paso {selectedRole ? '2' : '1'} de 2 ·{' '}
            {selectedRole ? roleLabels[selectedRole] : 'Elegí tu rol'}
          </span>
          <h1 id="login-title">
            {selectedRole
              ? `Ingresar como ${roleLabels[selectedRole]}`
              : 'Bienvenido a NÁCAR'}
          </h1>
          <p className="muted">
            {selectedRole
              ? 'Completá ambos campos para comenzar el servicio.'
              : 'Elegí tu espacio y comenzá el servicio.'}
          </p>
        </div>
        {selectedRole ? (
          <form
            onSubmit={submit}
            noValidate
            autoComplete="off"
            aria-labelledby="login-title"
            aria-describedby="demo-access-note"
          >
            <fieldset className="form-fieldset">
              <div className="login-field">
                <label htmlFor="login-username">Usuario</label>
                <input
                  ref={usernameInput}
                  id="login-username"
                  name="username"
                  type="text"
                  required
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  aria-invalid={usernameError || undefined}
                  aria-describedby={
                    usernameError ? 'username-error' : undefined
                  }
                  onChange={(event) => {
                    setUsername(event.target.value)
                    setError('')
                  }}
                />
                {usernameError && (
                  <p id="username-error" className="form-error" role="alert">
                    Ingresá un usuario.
                  </p>
                )}
              </div>
              <PasswordInput
                label="Contraseña"
                value={password}
                inputRef={passwordInput}
                error={passwordError ? 'Ingresá una contraseña.' : undefined}
                onChange={(value) => {
                  setPassword(value)
                  setError('')
                }}
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary-button" type="submit">
                Ingresar
              </button>
              <button
                className="text-button login-back"
                type="button"
                onClick={() => chooseRole(null)}
              >
                Volver a elegir rol
              </button>
            </fieldset>
          </form>
        ) : (
          <div
            className="demo-roles"
            role="group"
            aria-label="Selección de rol"
          >
            {roles.map((role) => {
              const available = data.users.some(
                (user) => user.role === role && user.active,
              )
              return (
                <button
                  ref={(button) => {
                    roleButtons.current[role] = button
                  }}
                  className="role-access"
                  type="button"
                  key={role}
                  disabled={!available}
                  onClick={() => chooseRole(role)}
                >
                  <Icon
                    name={
                      role === 'mozo'
                        ? 'mesas'
                        : role === 'chef'
                          ? 'cocina'
                          : role === 'repartidor'
                            ? 'repartidor'
                            : 'admin'
                    }
                  />
                  <span>
                    <strong>{roleLabels[role]}</strong>
                    <small>
                      {available
                        ? roleDescriptions[role]
                        : 'Sin perfiles demo habilitados'}
                    </small>
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              )
            })}
          </div>
        )}
        {warning && (
          <p className="warning" role="alert">
            {warning}
          </p>
        )}
        <p id="demo-access-note" className="login-note">
          Acceso de demostración, sin verificación de credenciales
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
          <p>Salón, cocina y administración, al mismo ritmo.</p>
        </div>
      </aside>
    </main>
  )
}
