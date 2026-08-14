#!/usr/bin/env node

import { parseSetupOptions } from './options.js'

export function main(argv = process.argv.slice(2), env = process.env): void {
  parseSetupOptions(argv, env)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
