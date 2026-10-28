import { setTheme, useTheme } from '../state/theme'
import { Icon } from './Icon'

export function ThemeToggle() {
  const theme = useTheme()
  const siguiente = theme === 'dark' ? 'light' : 'dark'
  const etiqueta =
    siguiente === 'dark' ? 'Activar modo oscuro' : 'Activar modo claro'
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      onClick={() => setTheme(siguiente)}
      aria-label={etiqueta}
      title={etiqueta}
    >
      <Icon name={siguiente === 'dark' ? 'luna' : 'sol'} />
    </button>
  )
}
