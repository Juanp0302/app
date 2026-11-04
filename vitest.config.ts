import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    // Mismo atajo "@/..." que usa Next (tsconfig paths), para poder probar rutas de API.
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    exclude: ['**/node_modules/**', '**/.next/**'],
    // Con todos los archivos en paralelo, preparar la BD temporal de cada uno puede pasar de los 10 s por defecto.
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
})
