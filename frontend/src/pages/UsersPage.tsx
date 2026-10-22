import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { PasswordInput } from '../components/PasswordInput'
import { useRestaurant } from '../state/useRestaurant'
import { restaurantStore } from '../state/store'
import {
  normalizeUsername,
  validPassword,
  validUsername,
} from '../state/credentials'
import { roleLabels, type UserProfile, type Role } from '../types'
import { isActive } from '../state/model'

function UserEditor({
  user,
  resetPassword = false,
  onClose,
}: {
  user?: UserProfile
  resetPassword?: boolean
  onClose: () => void
}) {
  const { session } = useRestaurant()
  const self = user?.id === session?.id
  const [draft, setDraft] = useState<UserProfile>(() => ({
    id: user?.id ?? crypto.randomUUID(),
    name: user?.name ?? '',
    username: user?.username ?? '',
    role: user?.role ?? 'mozo',
    active: user?.active ?? true,
  }))
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const passwordRequired = !user || resetPassword
  const nameInput = useRef<HTMLInputElement>(null)
  const usernameInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const confirmationInput = useRef<HTMLInputElement>(null)
  const formId = useId()
  const nameError = submitted && !draft.name.trim() ? 'Ingresá un nombre.' : ''
  const usernameError =
    submitted && !validUsername(normalizeUsername(draft.username ?? ''))
      ? 'Usá de 3 a 40 caracteres: a–z, 0–9, punto, guion o guion bajo.'
      : ''
  const passwordError =
    submitted && passwordRequired && !validPassword(password)
      ? 'Ingresá una contraseña de 10 a 128 caracteres que no sea solo espacios.'
      : ''
  const confirmationError =
    submitted &&
    passwordRequired &&
    (!confirmation || password !== confirmation)
      ? 'Las contraseñas deben coincidir.'
      : ''
  useEffect(() => {
    if (resetPassword) passwordInput.current?.focus()
    else nameInput.current?.focus()
  }, [resetPassword])
  const close = () => {
    if (!busy) onClose()
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setSubmitted(true)
    setError('')
    if (!draft.name.trim()) {
      nameInput.current?.focus()
      return
    }
    if (!validUsername(normalizeUsername(draft.username ?? ''))) {
      usernameInput.current?.focus()
      return
    }
    if (passwordRequired && !validPassword(password)) {
      passwordInput.current?.focus()
      return
    }
    if (passwordRequired && (!confirmation || password !== confirmation)) {
      confirmationInput.current?.focus()
      return
    }
    setBusy(true)
    try {
      const message = await restaurantStore.saveUser(
        draft,
        passwordRequired ? password : undefined,
      )
      setError(message)
      if (!message) {
        setPassword('')
        setConfirmation('')
        onClose()
      }
    } catch {
      setError('No se pudo guardar el usuario. Volvé a intentarlo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={
        resetPassword
          ? 'Restablecer contraseña'
          : user
            ? 'Editar usuario'
            : 'Crear usuario'
      }
      onClose={close}
    >
      {resetPassword && (
        <p>
          Nueva contraseña para <strong>{user?.name}</strong> · {user?.username}
          . Sus sesiones abiertas se cerrarán.
        </p>
      )}
      <form
        className="editor-form"
        onSubmit={submit}
        noValidate
        autoComplete="off"
        aria-busy={busy}
      >
        <fieldset className="form-fieldset" disabled={busy}>
          {!resetPassword && (
            <>
              <div className="login-field">
                <label htmlFor={`${formId}-name`}>Nombre</label>
                <input
                  ref={nameInput}
                  id={`${formId}-name`}
                  autoFocus
                  maxLength={80}
                  required
                  value={draft.name}
                  aria-invalid={!!nameError || undefined}
                  aria-describedby={
                    nameError ? `${formId}-name-error` : undefined
                  }
                  onChange={(event) => {
                    setDraft({ ...draft, name: event.target.value })
                    setError('')
                  }}
                />
                {nameError && (
                  <p
                    className="form-error"
                    id={`${formId}-name-error`}
                    role="alert"
                  >
                    {nameError}
                  </p>
                )}
              </div>
              <div className="login-field">
                <label htmlFor={`${formId}-username`}>Usuario</label>
                <input
                  ref={usernameInput}
                  id={`${formId}-username`}
                  maxLength={40}
                  required
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={draft.username}
                  aria-invalid={!!usernameError || undefined}
                  aria-describedby={`${formId}-username-help${usernameError ? ` ${formId}-username-error` : ''}`}
                  onChange={(event) => {
                    setDraft({ ...draft, username: event.target.value })
                    setError('')
                  }}
                />
                <small id={`${formId}-username-help`} className="muted">
                  Único para todos los roles. De 3 a 40 caracteres: a–z, 0–9,
                  punto, guion o guion bajo.
                </small>
                {usernameError && (
                  <p
                    className="form-error"
                    id={`${formId}-username-error`}
                    role="alert"
                  >
                    {usernameError}
                  </p>
                )}
              </div>
              <label>
                Rol
                <select
                  disabled={self}
                  value={draft.role}
                  onChange={(event) =>
                    setDraft({ ...draft, role: event.target.value as Role })
                  }
                >
                  {Object.entries(roleLabels).map(([role, label]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  disabled={self}
                  checked={draft.active}
                  onChange={(event) =>
                    setDraft({ ...draft, active: event.target.checked })
                  }
                />
                Cuenta habilitada
              </label>
            </>
          )}
          {passwordRequired && (
            <>
              <PasswordInput
                label={resetPassword ? 'Nueva contraseña' : 'Contraseña'}
                value={password}
                inputRef={passwordInput}
                autoComplete="new-password"
                error={passwordError}
                onChange={(value) => {
                  setPassword(value)
                  setError('')
                }}
              />
              <PasswordInput
                label="Confirmar contraseña"
                value={confirmation}
                inputRef={confirmationInput}
                autoComplete="new-password"
                error={confirmationError}
                onChange={(value) => {
                  setConfirmation(value)
                  setError('')
                }}
              />
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <p className="login-note">
            La contraseña se guarda de forma segura en el servidor.
          </p>
          <div className="actions">
            <button className="primary-button" type="submit">
              {busy
                ? 'Guardando…'
                : resetPassword
                  ? 'Guardar nueva contraseña'
                  : 'Guardar usuario'}
            </button>
            <button className="secondary-button" type="button" onClick={close}>
              Volver
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}

export function UsersPage() {
  const { data, session, actUser: act } = useRestaurant()
  const [editing, setEditing] = useState<UserProfile | 'new' | null>(null)
  const [resetting, setResetting] = useState<UserProfile | null>(null)
  const [deleting, setDeleting] = useState<UserProfile | null>(null)
  const [error, setError] = useState('')
  return (
    <>
      <section className="page-intro">
        <div>
          <span className="eyebrow">Equipo · Cuentas del restaurante</span>
          <h1>Un equipo, distintas miradas</h1>
          <p>
            Creá cuentas, asigná roles y administrá el acceso al restaurante.
          </p>
        </div>
        <button className="primary-button" onClick={() => setEditing('new')}>
          Crear usuario
        </button>
      </section>
      <div className="users-grid">
        {data.users.map((user) => {
          const blocked =
            user.id === session?.id ||
            data.orders.some(
              (order) => order.waiterId === user.id && isActive(order),
            )
          return (
            <article key={user.id} className="panel user-card">
              <span className="user-avatar" aria-hidden="true">
                {user.name.slice(0, 1)}
              </span>
              <h2>{user.name}</h2>
              <p>
                Usuario: <strong>{user.username}</strong>
                <br />
                {roleLabels[user.role]}{' '}
                {user.id === session?.id && '· Tu sesión'}
              </p>
              <span
                className={`status status--${user.active ? 'listo' : 'cancelado'}`}
              >
                {user.active ? 'Habilitado' : 'Deshabilitado'}
              </span>
              <div className="card-actions">
                <button
                  className="secondary-button"
                  onClick={() => setEditing(user)}
                >
                  Editar
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setResetting(user)}
                >
                  Restablecer contraseña
                </button>
                <button
                  className="text-button danger-text"
                  disabled={blocked || !user.active}
                  onClick={() => {
                    setError('')
                    setDeleting(user)
                  }}
                >
                  Desactivar
                </button>
              </div>
              {blocked && (
                <small className="muted">
                  {user.id === session?.id
                    ? 'Tu acceso de administrador se conserva.'
                    : 'Cambio bloqueado: pedidos activos.'}
                </small>
              )}
            </article>
          )
        })}
      </div>
      {editing && (
        <UserEditor
          user={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {resetting && (
        <UserEditor
          user={resetting}
          resetPassword
          onClose={() => setResetting(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Desactivar usuario"
          description={`Se quitará el acceso de ${deleting.name}. Sus pedidos históricos se conservarán.`}
          error={error}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const message = await act({ type: 'deleteUser', id: deleting.id })
            setError(message)
            if (!message) setDeleting(null)
          }}
        />
      )}
    </>
  )
}
