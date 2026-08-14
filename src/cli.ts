#!/usr/bin/env node

import { parseSetupOptions } from './options.js'

export function main(argv = process.argv.slice(2), env = process.env): void {
  try {
    parseSetupOptions(argv, env)
  } catch {
    process.stderr.write('loongport: setup options are invalid\n')
    process.exitCode = 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
