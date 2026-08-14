import { loadObservationFeed } from '../directory/observations.js'
import { mergeSiteViews } from '../directory/merge.js'
import { loadVerifiedDirectory } from '../directory/policy.js'
import type { SiteView } from '../directory/types.js'
import { createProviderHost } from './provider.js'
import type { Credentials, CredentialState, Settings } from './provider.js'

export interface HostContext {
  credentials: Credentials
  settings: Settings
  fetcher?: typeof fetch
}

export interface LoongPortHost {
  listSites(): Promise<SiteView[]>
  configureSite(id: string): Promise<void>
  saveCredential(id: string, value: string): Promise<void>
  clearCredential(id: string): Promise<void>
  describeCredential(id: string): Promise<CredentialState>
}

export function createLoongPortHost(ctx: HostContext): LoongPortHost {
  const fetcher = ctx.fetcher ?? fetch
  const providers = createProviderHost(ctx)
  async function siteFor(id: string) {
    const directory = await loadVerifiedDirectory(fetcher)
    const site = directory.sites.find((candidate) => candidate.id === id)
    if (site === undefined) throw new Error('Unknown LoongPort provider')
    return site
  }
  return {
    async listSites() {
      const directory = await loadVerifiedDirectory(fetcher)
      return mergeSiteViews(directory, await loadObservationFeed(fetcher))
    },
    async configureSite(id) { await providers.configureSite(await siteFor(id)) },
    async saveCredential(id, value) { await providers.saveCredential(await siteFor(id), value) },
    async clearCredential(id) { await providers.clearCredential(await siteFor(id)) },
    async describeCredential(id) { return providers.describeCredential(await siteFor(id)) },
  }
}

/** Cordis-compatible host entrypoint. Compositions retain the returned RPC surface. */
export function apply(ctx: HostContext): LoongPortHost {
  return createLoongPortHost(ctx)
}
