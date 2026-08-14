import { useEffect, useSyncExternalStore } from 'react'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

import type { SiteView } from '../directory/types.js'
import { LoongPortSection } from './LoongPortSection.js'
import { en, NS, zh } from './locales.js'
import { createLoongPortStore, type LoongPortApi } from './store.js'

type SiteInput = { siteId: string }
type SaveApiKeyInput = SiteInput & { value: string }

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$6c6f6f6e67706f7274 {
    listSites: () => Promise<RemoteResult<SiteView[]>>
    configureSite: (input: SiteInput) => Promise<RemoteResult<void>>
    saveApiKey: (input: SaveApiKeyInput) => Promise<RemoteResult<void>>
    clearApiKey: (input: SiteInput) => Promise<RemoteResult<void>>
    describeApiKey: (input: SiteInput) => Promise<RemoteResult<{ configured: boolean }>>
  }

  interface TypertRemoteMap {
    'loongport/listSites': () => Promise<RemoteResult<SiteView[]>>
    'loongport/configureSite': (input: SiteInput) => Promise<RemoteResult<void>>
    'loongport/saveApiKey': (input: SaveApiKeyInput) => Promise<RemoteResult<void>>
    'loongport/clearApiKey': (input: SiteInput) => Promise<RemoteResult<void>>
    'loongport/describeApiKey': (input: SiteInput) => Promise<RemoteResult<{ configured: boolean }>>
  }

  interface TypertRemoteNamespaceMap {
    loongport: TypertRemoteNamespace$6c6f6f6e67706f7274
  }
}

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

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'loongport: dictionaries')
  const store = createLoongPortStore(remoteApi(ctx))
  const injected = () => ({ store })

  ctx.effect(() => ctx.on('connection/reset', () => {
    if (store.hasLoaded()) void store.refreshCredentials()
  }), 'loongport: connection reset')
  ctx.effect(() => ctx.remote.$on('credentials/updated', () => {
    if (store.hasLoaded()) void store.refreshCredentials()
  }), 'loongport: credential invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'loongport',
    order: 30,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
    inject: injected,
  }, LoongPortSection))
  ctx.slots.inject('settings.onboarding', () => ctx.slots.register({
    name: 'settings.onboarding',
    id: 'loongport',
    order: 30,
    locale: NS,
    inject: injected,
  }, LoongPortOnboarding))
}

type LoongPortOnboardingProps = import('@deepseek-ai/dsh-client-ui-slots').PropsRuntime<'settings.onboarding'>
  & import('@deepseek-ai/dsh-client-ui-slots').PropsLocale<typeof NS>
  & import('@deepseek-ai/dsh-client-ui-slots').InjectFace<{ store: ReturnType<typeof createLoongPortStore> }>

function LoongPortOnboarding({ complete, openSection, store, t }: LoongPortOnboardingProps): React.JSX.Element | null {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => {
    if (!store.hasLoaded()) void store.load()
    if (snapshot.phase === 'directory-unavailable' || (snapshot.phase === 'ready' && snapshot.sites.some((site) => site.credential.configured))) {
      complete()
    }
  }, [complete, snapshot.phase, snapshot.sites, store])
  if (snapshot.phase !== 'ready' || snapshot.sites.some((site) => site.credential.configured)) return null

  return <aside>
    <h3>{t('onboardingTitle')}</h3>
    <p>{t('onboardingDescription')}</p>
    <button onClick={() => {
      openSection('loongport')
      complete()
    }} type="button">{t('onboardingAction')}</button>
  </aside>
}
