import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repoBase = '/Branch/'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages project site: /Branch/
  // Local dev/preview: /
  base: command === 'build' ? repoBase : '/',
  plugins: [react(), tailwindcss()],
}))
