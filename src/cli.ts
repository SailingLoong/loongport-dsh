#!/usr/bin/env node

import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { parseSetupOptions } from './options.js'
import { applySetup } from './files.js'
import type { SetupResult } from './files.js'
import type { SetupOptions } from './options.js'

export function runSetup(options: SetupOptions): Promise<SetupResult> {
  return applySetup(options)
}

export async function main(argv = process.argv.slice(2), env = process.env): Promise<void> {
  try {
    const result = await runSetup(parseSetupOptions(argv, env))
    process.stdout.write(result.written
      ? 'loongport: DSH configuration updated\n'
      : 'loongport: dry run; use --write to apply DSH configuration\n')
  } catch {
    process.stderr.write('loongport: setup options are invalid\n')
    process.exitCode = 1
  }
}

function isMainModule(moduleUrl: string, entryPath: string | undefined): boolean {
  return entryPath !== undefined && fileURLToPath(moduleUrl) === realpathSync(entryPath)
}

if (isMainModule(import.meta.url, process.argv[1])) {
  void main()
}
