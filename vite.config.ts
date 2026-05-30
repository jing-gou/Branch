import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rootDir = dirname(fileURLToPath(import.meta.url))
const githubProjectBase = '/Branch/'

function resolveProductionBase(): string {
  if (process.env.VITE_BASE) {
    const base = process.env.VITE_BASE.trim()
    return base.endsWith('/') ? base : `${base}/`
  }

  const cnamePath = resolve(rootDir, 'public/CNAME')
  if (existsSync(cnamePath) && readFileSync(cnamePath, 'utf8').trim()) {
    return '/'
  }

  return githubProjectBase
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Custom domain (public/CNAME): /
  // GitHub project site: /Branch/
  // Local dev: /
  base: command === 'build' ? resolveProductionBase() : '/',
  plugins: [react(), tailwindcss()],
}))
