import { parseDocument } from 'yaml'
import { describe, expect, it } from 'vitest'

import { buildProviderProfile, mergeCredentials, mergeSettings } from '../src/dsh-config.js'
import type { SetupOptions } from '../src/options.js'

const options: SetupOptions = {
  baseUrl: 'https://relay.example.com/v1',
  route: 'loongport',
  credentialName: 'LOONGPORT_API_KEY',
  models: ['model-a', 'model-b'],
  dshHome: '/tmp/dsh',
  write: true,
  apiKey: 'test-api-key',
}

describe('DSH configuration documents', () => {
  it('builds the LoongPort provider profile expected by DSH', () => {
    expect(buildProviderProfile(options)).toEqual({
      displayName: 'LoongPort',
      apiKeyEnv: 'LOONGPORT_API_KEY',
      api: 'openai-completions',
      baseURL: 'https://relay.example.com/v1',
      models: [{ id: 'model-a' }, { id: 'model-b' }],
    })
  })

  it('updates only the selected provider route while preserving unrelated settings', () => {
    const text = [
      'other: true',
      'llm-pi-ai:',
      '  timeout: 30',
      '  providers:',
      '    openai:',
      '      displayName: OpenAI',
      '    loongport:',
      '      obsolete: value',
      '',
    ].join('\n')

    const merged = mergeSettings(text, options)
    const document = parseDocument(merged)

    expect(document.toJS()).toEqual({
      other: true,
      'llm-pi-ai': {
        timeout: 30,
        providers: {
          openai: { displayName: 'OpenAI' },
          loongport: {
            displayName: 'LoongPort',
            apiKeyEnv: 'LOONGPORT_API_KEY',
            api: 'openai-completions',
            baseURL: 'https://relay.example.com/v1',
            models: [{ id: 'model-a' }, { id: 'model-b' }],
          },
        },
      },
    })
    expect(merged).not.toContain(options.apiKey)
  })

  it('updates only the selected credential while preserving other credentials', () => {
    const merged = mergeCredentials('EXISTING: keep\nOTHER_SECRET: unchanged\n', options)

    expect(parseDocument(merged).toJS()).toEqual({
      EXISTING: 'keep',
      OTHER_SECRET: 'unchanged',
      LOONGPORT_API_KEY: 'test-api-key',
    })
  })
})
