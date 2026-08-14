import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  entry: ['src/cli.ts', 'src/index.ts', 'src/host/index.ts'],
  format: ['esm'],
  shims: true,
  splitting: false,
  target: 'node20',
})
