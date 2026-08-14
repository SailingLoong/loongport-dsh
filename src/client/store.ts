import type { SiteView } from '../directory/types.js'

export type LoongPortApi = {
  listSites(): Promise<SiteView[]>
  configureSite(input: { siteId: string }): Promise<void>
  saveApiKey(input: { siteId: string; value: string }): Promise<void>
  clearApiKey(input: { siteId: string }): Promise<void>
  describeApiKey(input: { siteId: string }): Promise<{ configured: boolean }>
}

export type StoreSiteView = SiteView

export type StoreSite = StoreSiteView & {
  credential: { configured: boolean }
}

export type ClientStoreSnapshot = {
  phase: 'loading' | 'ready' | 'directory-unavailable'
  sites: StoreSite[]
  error: 'directory-unavailable' | null
}

export type LoongPortStore = {
  getSnapshot(): ClientStoreSnapshot
  subscribe(listener: () => void): () => void
  load(): Promise<void>
  refresh(): Promise<void>
  refreshCredentials(): Promise<void>
  configureSite(input: { siteId: string }): Promise<void>
  saveApiKey(input: { siteId: string; value: string }): Promise<void>
  clearApiKey(input: { siteId: string }): Promise<void>
  hasLoaded(): boolean
}

function unavailableError(): Error {
  return new Error('This LoongPort provider is unavailable for manual API-key configuration')
}

export function createLoongPortStore(api: LoongPortApi): LoongPortStore {
  let snapshot: ClientStoreSnapshot = {
    phase: 'loading',
    sites: [],
    error: null,
  }
  let loaded = false
  const listeners = new Set<() => void>()

  function publish(next: ClientStoreSnapshot): void {
    snapshot = next
    for (const listener of listeners) listener()
  }

  function site(siteId: string): StoreSite {
    const found = snapshot.sites.find((candidate) => candidate.id === siteId)
    if (found === undefined) throw unavailableError()
    return found
  }

  async function describe(siteView: SiteView): Promise<{ configured: boolean }> {
    if (siteView.disabled === true || siteView.authorization?.kind !== 'manual-api-key') {
      return { configured: false }
    }
    try {
      const state = await api.describeApiKey({ siteId: siteView.id })
      return { configured: state.configured === true }
    } catch {
      return { configured: false }
    }
  }

  async function load(): Promise<void> {
    publish({ phase: 'loading', sites: snapshot.sites, error: null })
    try {
      const policySites = await api.listSites()
      const sites = await Promise.all(policySites.map(async (siteView) => ({
        ...siteView,
        credential: await describe(siteView),
      })))
      loaded = true
      publish({ phase: 'ready', sites, error: null })
    } catch {
      publish({ phase: 'directory-unavailable', sites: [], error: 'directory-unavailable' })
    }
  }

  async function refreshCredentials(): Promise<void> {
    if (!loaded) return
    const sites = await Promise.all(snapshot.sites.map(async (siteView) => ({
      ...siteView,
      credential: await describe(siteView),
    })))
    publish({ ...snapshot, phase: 'ready', sites, error: null })
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    load,
    refresh: load,
    refreshCredentials,
    hasLoaded: () => loaded,
    async configureSite(input) {
      const selected = site(input.siteId)
      if (selected.disabled === true || selected.authorization?.kind !== 'manual-api-key') throw unavailableError()
      await api.configureSite(input)
    },
    async saveApiKey(input) {
      const selected = site(input.siteId)
      if (selected.disabled === true || selected.authorization?.kind !== 'manual-api-key') throw unavailableError()
      await api.saveApiKey(input)
      await api.configureSite({ siteId: input.siteId })
      publish({
        ...snapshot,
        sites: snapshot.sites.map((candidate) => candidate.id === input.siteId
          ? { ...candidate, credential: { configured: true } }
          : candidate),
      })
    },
    async clearApiKey(input) {
      const selected = site(input.siteId)
      if (selected.disabled === true || selected.authorization?.kind !== 'manual-api-key') throw unavailableError()
      await api.clearApiKey(input)
      publish({
        ...snapshot,
        sites: snapshot.sites.map((candidate) => candidate.id === input.siteId
          ? { ...candidate, credential: { configured: false } }
          : candidate),
      })
    },
  }
}
