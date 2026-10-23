import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    // Mismo atajo "@/..." que usa Next (tsconfig paths), para poder probar rutas de API.
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
})
