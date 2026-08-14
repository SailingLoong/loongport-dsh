import { describe, expect, it, vi } from 'vitest'

import { createLoongPortStore } from '../src/client/store.js'
import type { LoongPortApi, StoreSiteView } from '../src/client/store.js'

const enabledSite: StoreSiteView = {
  id: 'bestapi',
  displayName: 'BestAPI',
  origin: 'https://api.bestapi.store/',
  entryUrl: 'https://api.bestapi.store/',
  apiBaseUrl: 'https://api.bestapi.store/v1',
  models: [{ id: 'deepseek-v4-flash', default: true }, { id: 'deepseek-v4-pro' }],
  veridropHosts: ['api.bestapi.store'],
  authorization: { kind: 'manual-api-key' },
  sponsorship: { label: 'Sponsored by BestAPI', url: 'https://api.bestapi.store/sponsor' },
  observation: undefined,
}

const disabledSite: StoreSiteView = {
  ...enabledSite,
  id: 'disabled',
  displayName: 'Disabled provider',
  disabled: true,
}

function api(overrides: Partial<LoongPortApi> = {}): LoongPortApi {
  return {
    listSites: vi.fn(async () => [enabledSite]),
    configureSite: vi.fn(async () => undefined),
    saveApiKey: vi.fn(async () => undefined),
    clearApiKey: vi.fn(async () => undefined),
    describeApiKey: vi.fn(async () => ({ configured: false })),
    ...overrides,
  }
}

describe('createLoongPortStore', () => {
  it('starts in a loading state and exposes safe configured state after loading', async () => {
    const store = createLoongPortStore(api())

    expect(store.getSnapshot()).toMatchObject({ phase: 'loading', sites: [] })
    await store.load()

    expect(store.getSnapshot()).toMatchObject({
      phase: 'ready',
      sites: [{ id: 'bestapi', credential: { configured: false } }],
    })
    expect(JSON.stringify(store.getSnapshot())).not.toContain('manual-input')
  })

  it('represents an unavailable verified directory without exposing transport errors', async () => {
    const store = createLoongPortStore(api({ listSites: vi.fn(async () => { throw new Error('private fetch detail') }) }))

    await store.load()

    expect(store.getSnapshot()).toMatchObject({ phase: 'directory-unavailable', sites: [] })
    expect(store.getSnapshot().error).toBe('directory-unavailable')
    expect(JSON.stringify(store.getSnapshot())).not.toContain('private fetch detail')
  })

  it('keeps policy sites visible when observations are unavailable', async () => {
    const store = createLoongPortStore(api({ listSites: vi.fn(async () => [{ ...enabledSite, observation: undefined }]) }))

    await store.load()

    expect(store.getSnapshot().sites).toHaveLength(1)
    expect(store.getSnapshot().sites[0]).toMatchObject({ id: 'bestapi', observation: undefined })
  })

  it('does not call RPCs for a disabled site', async () => {
    const client = api({ listSites: vi.fn(async () => [disabledSite]) })
    const store = createLoongPortStore(client)
    await store.load()

    await expect(store.saveApiKey({ siteId: 'disabled', value: 'manual-input' })).rejects.toThrow('unavailable')
    expect(client.saveApiKey).not.toHaveBeenCalled()
    expect(client.configureSite).not.toHaveBeenCalled()
  })

  it('saves then configures a manual key and records only configured boolean', async () => {
    const client = api({ describeApiKey: vi.fn(async () => ({ configured: false })) })
    const store = createLoongPortStore(client)
    await store.load()

    await store.saveApiKey({ siteId: 'bestapi', value: 'manual-input' })

    expect(client.saveApiKey).toHaveBeenCalledWith({ siteId: 'bestapi', value: 'manual-input' })
    expect(client.configureSite).toHaveBeenCalledWith({ siteId: 'bestapi' })
    expect(store.getSnapshot().sites[0].credential).toEqual({ configured: true })
    expect(JSON.stringify(store.getSnapshot())).not.toContain('manual-input')
  })

  it('does not mark a site configured when saving the key is rejected', async () => {
    const client = api({ saveApiKey: vi.fn(async () => { throw new Error('save failed') }) })
    const store = createLoongPortStore(client)
    await store.load()

    await expect(store.saveApiKey({ siteId: 'bestapi', value: 'manual-input' })).rejects.toThrow('save failed')

    expect(client.configureSite).not.toHaveBeenCalled()
    expect(store.getSnapshot().sites[0].credential).toEqual({ configured: false })
    expect(JSON.stringify(store.getSnapshot())).not.toContain('manual-input')
  })

  it('refreshes credential state as configured:boolean only', async () => {
    const client = api({ describeApiKey: vi.fn(async () => ({ configured: true, source: 'file', writable: true } as never)) })
    const store = createLoongPortStore(client)
    await store.load()

    expect(store.getSnapshot().sites[0].credential).toEqual({ configured: true })
    expect(Object.keys(store.getSnapshot().sites[0].credential)).toEqual(['configured'])
  })
})
