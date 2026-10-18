import type { PasswordCredential } from '../types'

export const DEMO_PASSWORD = 'NacarDemo123!'
const iterations = 210000
export const normalizeUsername = (username: string) =>
  username.trim().toLowerCase()
export const validUsername = (username: unknown): username is string =>
  typeof username === 'string' && /^[a-z0-9._-]{3,40}$/.test(username)
export const validPassword = (password: string) =>
  password.trim().length > 0 && password.length <= 128

export function validCredential(value: unknown): value is PasswordCredential {
  if (typeof value !== 'object' || value === null) return false
  const credential = value as Record<string, unknown>
  return (
    credential.algorithm === 'PBKDF2-SHA-256' &&
    credential.iterations === iterations &&
    typeof credential.salt === 'string' &&
    /^[a-f0-9]{32}$/.test(credential.salt) &&
    typeof credential.hash === 'string' &&
    /^[a-f0-9]{64}$/.test(credential.hash)
  )
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

async function deriveHash(password: string, salt: string): Promise<string> {
  if (!crypto.subtle)
    throw new Error(
      'La demo requiere HTTPS o localhost para comprobar contraseñas.',
    )
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const saltBytes = Uint8Array.from(salt.match(/.{2}/g) ?? [], (pair) =>
    parseInt(pair, 16),
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    key,
    256,
  )
  return toHex(new Uint8Array(bits))
}

export async function createCredential(
  password: string,
): Promise<PasswordCredential> {
  if (!validPassword(password))
    throw new Error(
      'Ingresá una contraseña de 1 a 128 caracteres que no sea solo espacios.',
    )
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  return {
    algorithm: 'PBKDF2-SHA-256',
    iterations,
    salt,
    hash: await deriveHash(password, salt),
  }
}

export async function verifyPassword(
  password: string,
  credential: PasswordCredential,
): Promise<boolean> {
  if (!validCredential(credential) || !validPassword(password)) return false
  const hash = await deriveHash(password, credential.salt)
  let difference = 0
  for (let index = 0; index < hash.length; index++)
    difference |= hash.charCodeAt(index) ^ credential.hash.charCodeAt(index)
  return difference === 0
}

export function initialUsername(id: string, index: number): string {
  if (id === 'admin-1') return 'admin'
  if (id === 'chef-1') return 'chef'
  if (/^w-[1-4]$/.test(id)) return `mozo${id.slice(2)}`
  return `usuario${index + 1}`
}
