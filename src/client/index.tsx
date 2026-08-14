import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

import { LoongPortSection } from './LoongPortSection.js'
import { en, NS, zh } from './locales.js'
import { createLoongPortStore, type LoongPortApi } from './store.js'
import { TYPERT_REMOTE } from './typert.remote.js'

export const inject = ['slots', 'locale', 'connection', 'remote']

function unwrap<T>(result: RemoteResult<T>): T {
  if (result.ok) return result.value
  throw new Error('LoongPort settings are temporarily unavailable')
}

function remoteApi(ctx: ClientContext): LoongPortApi {
  return {
    async listSites() { return unwrap(await ctx.remote.loongport.listSites()) },
    async configureSite(input) { return unwrap(await ctx.remote.loongport.configureSite(input)) },
    async saveApiKey(input) { return unwrap(await ctx.remote.loongport.saveApiKey(input)) },
    async clearApiKey(input) { return unwrap(await ctx.remote.loongport.clearApiKey(input)) },
    async describeApiKey(input) { return unwrap(await ctx.remote.loongport.describeApiKey(input)) },
  }
}

export async function apply(ctx: ClientContext): Promise<void> {
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)
  ctx.effect(() => disposeRemote, 'loongport: remote')
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'loongport: dictionaries')
  const store = createLoongPortStore(remoteApi(ctx))
  const subscribeInvalidations = (listener: () => void) => {
    const disposeConnection = ctx.on('connection/reset', listener)
    const disposeCredentials = ctx.remote.$on('credentials/updated', listener)
    return () => {
      disposeConnection()
      disposeCredentials()
    }
  }
  const injected = () => ({ store, subscribeInvalidations })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'loongport',
    order: 30,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
    inject: injected,
  }, LoongPortSection))
}
