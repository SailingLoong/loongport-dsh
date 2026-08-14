import { loadObservationFeed } from '../directory/observations.js'
import { mergeSiteViews } from '../directory/merge.js'
import { loadVerifiedDirectory } from '../directory/policy.js'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-settings'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { SiteView } from '../directory/types.js'
import { createProviderHost } from './provider.js'
import type { Credentials, CredentialState, Settings } from './provider.js'

export const inject = ['credentials', 'settings']

export type HostContext = Pick<Context, 'credentials' | 'settings'>

export interface LoongPortHost {
  listSites(): Promise<SiteView[]>
  configureSite(id: string): Promise<void>
  saveCredential(id: string, value: string): Promise<void>
  clearCredential(id: string): Promise<void>
  describeCredential(id: string): Promise<CredentialState>
}

export type SiteInput = { siteId: string }

export function createLoongPortHost(
  ctx: HostContext,
  fetcher: typeof fetch = globalThis.fetch,
): LoongPortHost {
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

/** Registered Cordis/Typert service exported to the DSH Remote gateway. */
export class LoongPortRemoteService extends TypertRemoteService {
  private readonly host: LoongPortHost

  constructor(ctx: Context) {
    super(ctx, 'loongport')
    this.host = createLoongPortHost(ctx)
  }

  @Remote
  async listSites(): Promise<SiteView[]> {
    try {
      return await this.host.listSites()
    } catch {
      throw new Error('LoongPort directory is unavailable')
    }
  }

  @Remote
  async configureSite(input: SiteInput): Promise<void> {
    try {
      await this.host.configureSite(input.siteId)
    } catch {
      throw new Error('LoongPort provider configuration failed')
    }
  }

  @Remote
  async saveApiKey(input: SiteInput & { value: string }): Promise<void> {
    try {
      await this.host.saveCredential(input.siteId, input.value)
    } catch {
      throw new Error('LoongPort API key could not be saved')
    }
  }

  @Remote
  async clearApiKey(input: SiteInput): Promise<void> {
    try {
      await this.host.clearCredential(input.siteId)
    } catch {
      throw new Error('LoongPort API key could not be cleared')
    }
  }

  @Remote
  async describeApiKey(input: SiteInput): Promise<{ configured: boolean }> {
    try {
      const state = await this.host.describeCredential(input.siteId)
      return { configured: state.configured === true }
    } catch {
      throw new Error('LoongPort credential state is unavailable')
    }
  }
}

/** Cordis-compatible host entrypoint. The service registers itself with Cordis. */
export function apply(ctx: Context): LoongPortRemoteService {
  return new LoongPortRemoteService(ctx)
}
