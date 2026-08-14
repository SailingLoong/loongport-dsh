import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  entry: ['src/cli.ts', 'src/index.ts', 'src/host/index.ts', 'src/client/index.tsx'],
  format: ['esm'],
  shims: true,
  splitting: false,
  target: 'node20',
})
