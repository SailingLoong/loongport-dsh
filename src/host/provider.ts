import { normalizeSiteIdentifier } from '../directory/policy.js'
import type { DirectorySite } from '../directory/types.js'
import { credentialRef as toCredentialRef } from '@deepseek-ai/dsh-credentials'
import type { CredentialInfo, CredentialProvider as DshCredentials } from '@deepseek-ai/dsh-credentials'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { SettingsProvider as DshSettings } from '@deepseek-ai/dsh-settings'

export type CredentialState = CredentialInfo

export type Credentials = Pick<DshCredentials, 'set' | 'unset' | 'describe'>

export type ProviderProfile = {
  displayName: string
  api: 'openai-completions'
  baseURL: string
  apiKeyEnv: string
  models: Array<{ id: string }>
}

export type Settings = Pick<DshSettings, 'mutate'>

function credentialRef(site: DirectorySite): Parameters<Credentials['set']>[0] {
  return toCredentialRef(normalizeSiteIdentifier(site.id).credentialRef)
}

function ensureConfigurable(site: DirectorySite): asserts site is DirectorySite & {
  apiBaseUrl: string
  authorization: { kind: 'manual-api-key' }
} {
  if (site.disabled === true || site.authorization?.kind !== 'manual-api-key' || site.apiBaseUrl === undefined) {
    throw new Error('This LoongPort provider is unavailable for manual API-key configuration')
  }
}

function providerProfile(site: DirectorySite & { apiBaseUrl: string }, credentialRef: string): ProviderProfile {
  return {
    displayName: site.displayName,
    api: 'openai-completions',
    baseURL: site.apiBaseUrl,
    apiKeyEnv: credentialRef,
    models: site.models.map(({ id }) => ({ id })),
  }
}

export async function configureProvider(site: DirectorySite, _credentials: Credentials, settings: Settings): Promise<void> {
  ensureConfigurable(site)
  const { route, credentialRef: apiKeyEnv } = normalizeSiteIdentifier(site.id)
  await settings.mutate(settingsNamespace('llm-pi-ai'), [{
    op: 'set',
    path: ['providers', route],
    value: providerProfile(site, apiKeyEnv),
  }])
}

export type ProviderHost = {
  configureSite(site: DirectorySite): Promise<void>
  saveCredential(site: DirectorySite, value: string): Promise<void>
  clearCredential(site: DirectorySite): Promise<void>
  describeCredential(site: DirectorySite): Promise<CredentialState>
}

export function createProviderHost({ credentials, settings }: { credentials: Credentials; settings: Settings }): ProviderHost {
  return {
    configureSite: (site) => configureProvider(site, credentials, settings),
    async saveCredential(site, value) {
      ensureConfigurable(site)
      if (value.trim() === '') throw new Error('A LoongPort API key cannot be empty')
      await credentials.set(credentialRef(site), value)
    },
    async clearCredential(site) {
      ensureConfigurable(site)
      await credentials.unset(credentialRef(site))
    },
    async describeCredential(site) {
      ensureConfigurable(site)
      return credentials.describe(credentialRef(site))
    },
  }
}
