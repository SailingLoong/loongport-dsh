import { homedir } from 'node:os'
import { join } from 'node:path'

import { Command } from 'commander'

export interface SetupOptions {
  baseUrl: string
  route: string
  credentialName: string
  models: string[]
  dshHome: string
  write: boolean
  apiKey: string
}

interface ParsedSetupOptions {
  baseUrl: string
  route: string
  credentialName: string
  model: string[]
  write: boolean
}

function collectModel(value: string, previous: string[]): string[] {
  return [...previous, value]
}

function parseCommandOptions(argv: string[]): ParsedSetupOptions {
  const command = new Command()
    .exitOverride()
    .configureOutput({ writeErr: () => {}, writeOut: () => {} })
    .requiredOption('--base-url <url>')
    .option('--route <name>', 'DSH provider route', 'loongport')
    .option('--credential-name <name>', 'DSH credential name', 'LOONGPORT_API_KEY')
    .option('--model <id>', 'model identifier', collectModel, [])
    .option('--write', 'write the DSH configuration')

  command.parse(argv[0] === 'dsh' && argv[1] === 'setup' ? argv.slice(2) : argv, { from: 'user' })

  return command.opts<ParsedSetupOptions>()
}

function normalizeBaseUrl(value: string): string {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error('base URL must be a valid URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('base URL must use http or https')
  }

  if (url.username || url.password) {
    throw new Error('base URL must not include credentials')
  }

  return value.replace(/\/+$/, '')
}

export function parseSetupOptions(argv: string[], env: NodeJS.ProcessEnv): SetupOptions {
  const parsed = parseCommandOptions(argv)

  if (parsed.model.length === 0) {
    throw new Error('at least one --model is required')
  }

  if (parsed.route.trim().length === 0) {
    throw new Error('route must not be empty')
  }

  if (parsed.model.some((model) => model.trim().length === 0)) {
    throw new Error('model identifiers must not be empty')
  }

  if (new Set(parsed.model).size !== parsed.model.length) {
    throw new Error('model identifiers must be unique')
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(parsed.credentialName)) {
    throw new Error('credential name must be an environment variable name')
  }

  const baseUrl = normalizeBaseUrl(parsed.baseUrl)
  const apiKey = env.LOONGPORT_API_KEY

  if (!apiKey) {
    throw new Error('LOONGPORT_API_KEY is required')
  }

  return {
    baseUrl,
    route: parsed.route,
    credentialName: parsed.credentialName,
    models: parsed.model,
    dshHome: env.DSH_HOME || join(homedir(), '.dsh'),
    write: parsed.write ?? false,
    apiKey,
  }
}
