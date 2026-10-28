import { useSyncExternalStore } from 'react'

// Modo claro/oscuro: se guarda la elección; sin elección se sigue al sistema.
// index.html aplica el atributo antes de React para evitar el parpadeo inicial.
export type Theme = 'light' | 'dark'
const clave = 'nacar-tema'
const sistema = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'

function leerGuardado(): Theme | null {
  try {
    const valor = localStorage.getItem(clave)
    return valor === 'light' || valor === 'dark' ? valor : null
  } catch {
    return null
  }
}

const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((oyente) => oyente())

export function currentTheme(): Theme {
  const atributo = document.documentElement.dataset.theme
  return atributo === 'light' || atributo === 'dark'
    ? atributo
    : (leerGuardado() ?? sistema())
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(clave, theme)
  } catch {
    // Sin almacenamiento (modo privado): el cambio vale para esta pestaña.
  }
  avisar()
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  const consulta = window.matchMedia?.('(prefers-color-scheme: dark)')
  consulta?.addEventListener('change', oyente)
  return () => {
    oyentes.delete(oyente)
    consulta?.removeEventListener('change', oyente)
  }
}

export const useTheme = () =>
  useSyncExternalStore(suscribir, currentTheme, () => 'light' as Theme)
