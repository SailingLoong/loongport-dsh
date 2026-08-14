#!/usr/bin/env node

import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { parseSetupOptions } from './options.js'
import { applySetup, SetupApplicationError } from './files.js'
import type { SetupResult } from './files.js'
import type { SetupOptions } from './options.js'

export function runSetup(options: SetupOptions): Promise<SetupResult> {
  return applySetup(options)
}

function formatDryRun(options: SetupOptions, result: SetupResult): string {
  const models = options.models.map((model) => `    - ${model}`).join('\n')

  return [
    'loongport setup plan:',
    `  route: ${options.route}`,
    `  base URL: ${options.baseUrl}`,
    '  models:',
    models,
    `  credential reference: ${options.credentialName}`,
    `  settings path: ${result.settingsPath}`,
    `  credentials path: ${result.credentialsPath}`,
    '  written: false',
    '',
  ].join('\n')
}

export async function main(argv = process.argv.slice(2), env = process.env): Promise<void> {
  let options: SetupOptions

  try {
    options = parseSetupOptions(argv, env)
  } catch {
    process.stderr.write('loongport: setup options are invalid; check required flags and values\n')
    process.exitCode = 1
    return
  }

  try {
    const result = await runSetup(options)
    process.stdout.write(result.written
      ? 'loongport: DSH configuration updated\n'
      : formatDryRun(options, result))
  } catch (error) {
    const message = error instanceof SetupApplicationError
      ? error.message
      : 'setup could not be completed; check DSH files and permissions, then retry'
    process.stderr.write(`loongport: setup failed: ${message}\n`)
    process.exitCode = 1
  }
}

function isMainModule(moduleUrl: string, entryPath: string | undefined): boolean {
  return entryPath !== undefined && fileURLToPath(moduleUrl) === realpathSync(entryPath)
}

if (isMainModule(import.meta.url, process.argv[1])) {
  void main()
}
