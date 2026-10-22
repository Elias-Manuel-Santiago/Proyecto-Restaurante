// Las contraseñas se verifican y hashean exclusivamente en el backend.
export const normalizeUsername = (username: string) =>
  username.trim().toLowerCase()
export const validUsername = (username: unknown): username is string =>
  typeof username === 'string' && /^[a-z0-9._-]{3,40}$/.test(username)
export const validPassword = (password: string) =>
  password.length >= 10 && password.length <= 128 && password.trim().length > 0
