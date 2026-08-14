import { parseDocument } from 'yaml'

import type { SetupOptions } from './options.js'

export function buildProviderProfile(options: SetupOptions) {
  return {
    displayName: 'LoongPort',
    apiKeyEnv: options.credentialName,
    api: 'openai-completions',
    baseURL: options.baseUrl,
    models: options.models.map((id) => ({ id })),
  }
}

export function mergeSettings(text: string, options: SetupOptions): string {
  const document = parseDocument(text)

  document.setIn(['llm-pi-ai', 'providers', options.route], buildProviderProfile(options))

  return document.toString()
}

export function mergeCredentials(text: string, options: SetupOptions): string {
  const document = parseDocument(text)

  document.setIn([options.credentialName], options.apiKey)

  return document.toString()
}
