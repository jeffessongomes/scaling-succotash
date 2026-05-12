import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@azimute/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
})
