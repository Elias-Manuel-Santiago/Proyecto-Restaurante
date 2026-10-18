import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = {
    '/api': {
      target: env.VITE_API_TARGET || 'http://localhost:3005',
      changeOrigin: true,
    },
  }
  return {
    server: { proxy },
    preview: { proxy },
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  }
})
