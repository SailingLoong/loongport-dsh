import { describe, expect, it } from 'vitest'

import { createProviderHost, configureProvider } from '../src/host/provider.js'
import type { DirectorySite } from '../src/directory/types.js'

const site: DirectorySite = {
  id: 'bestapi',
  displayName: 'BestAPI',
  origin: 'https://api.bestapi.store/',
  entryUrl: 'https://api.bestapi.store/',
  apiBaseUrl: 'https://api.bestapi.store/v1',
  models: [{ id: 'deepseek-v4-flash', default: true }, { id: 'deepseek-v4-pro' }],
  veridropHosts: ['api.bestapi.store'],
  authorization: { kind: 'manual-api-key' },
}

describe('configureProvider', () => {
  it('updates only its normalized route without storing credential values in settings', async () => {
    const settings = {
      value: { 'llm-pi-ai': { providers: { unrelated: { apiKeyEnv: 'OTHER_KEY' } } } },
      read() { return this.value },
      async replace(value: unknown) { this.value = value as typeof this.value },
    }
    const credentials = {
      async set() {},
      async unset() {},
      async describe() { return { configured: false, writable: true } },
    }

    await configureProvider(site, credentials, settings)

    expect(settings.value).toEqual({
      'llm-pi-ai': {
        providers: {
          unrelated: { apiKeyEnv: 'OTHER_KEY' },
          'loongport-bestapi': {
            displayName: 'BestAPI',
            api: 'openai-completions',
            baseURL: 'https://api.bestapi.store/v1',
            apiKeyEnv: 'LOONGPORT_BESTAPI_API_KEY',
            models: [{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }],
          },
        },
      },
    })
  })

  it('exposes key operations that never return the submitted secret', async () => {
    const actions: string[] = []
    const credentials = {
      async set(ref: string, _value: string) { actions.push(`set:${ref}`) },
      async unset(ref: string) { actions.push(`unset:${ref}`) },
      async describe() { return { configured: true, source: 'file', writable: true } },
    }
    const settings = { value: {}, read() { return this.value }, async replace(value: unknown) { this.value = value as {} } }
    const host = createProviderHost({ credentials, settings })

    await expect(host.saveCredential(site, 'test-credential-value')).resolves.toBeUndefined()
    await expect(host.clearCredential(site)).resolves.toBeUndefined()
    await expect(host.describeCredential(site)).resolves.toEqual({ configured: true, source: 'file', writable: true })

    expect(actions).toEqual([
      'set:LOONGPORT_BESTAPI_API_KEY',
      'unset:LOONGPORT_BESTAPI_API_KEY',
    ])
  })
})
