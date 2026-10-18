import axios from 'axios'

/** El objeto original se conserva en el estado; aquí solo mostramos su mensaje. */
export function ErrorMessage({ error }: { error?: string | Error | null }) {
  if (!error) return null
  return (
    <p className="form-error" role="alert">
      {axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error
          ? error.message
          : error}
    </p>
  )
}
