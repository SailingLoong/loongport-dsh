import type { RemoteResult, TypertCodec, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'

import type { SiteView } from '../directory/types.js'

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

function strict(typeSymbol: string, schema: z.ZodType): Extract<TypertCodec, { mode: 'strict' }> {
  return { mode: 'strict', typeSymbol, schema }
}

const siteInputSchema = z.object({ siteId: z.string() })
const saveApiKeyInputSchema = siteInputSchema.extend({ value: z.string() })
const directoryModelSchema = z.object({
  id: z.string(),
  default: z.literal(true).optional(),
})
const observationSchema = z.object({
  veridropHost: z.string(),
  rank: z.number().nullable(),
  score: z.number().nullable(),
  samples: z.number().nullable(),
  observedAt: z.string().nullable(),
  reportUrl: z.string().nullable(),
  issues: z.array(z.string()),
})
const siteViewSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  origin: z.string(),
  entryUrl: z.string(),
  apiBaseUrl: z.string().optional(),
  inviteCode: z.string().optional(),
  models: z.array(directoryModelSchema),
  sponsorship: z.object({ label: z.string(), url: z.string() }).optional(),
  veridropHosts: z.array(z.string()),
  authorization: z.object({ kind: z.literal('manual-api-key') }).optional(),
  disabled: z.boolean().optional(),
  observation: observationSchema.optional(),
})

const listSitesResult = strict('loongport#SiteView[]', z.array(siteViewSchema))
const siteInput = strict('loongport#SiteInput', siteInputSchema)
const saveApiKeyInput = strict('loongport#SaveApiKeyInput', saveApiKeyInputSchema)
const voidResult = strict('void', z.undefined())
const describeApiKeyResult = strict('loongport#CredentialState', z.object({ configured: z.boolean() }))

export const TYPERT_REMOTE = {
  package: 'loongport',
  descriptors: [
    {
      id: 'loongport#loongport/listSites',
      service: 'loongport',
      namespace: 'loongport',
      method: 'listSites',
      invocation: { kind: 'direct' },
      parameters: [],
      result: listSitesResult,
    },
    {
      id: 'loongport#loongport/configureSite',
      service: 'loongport',
      namespace: 'loongport',
      method: 'configureSite',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: siteInput }],
      result: voidResult,
    },
    {
      id: 'loongport#loongport/saveApiKey',
      service: 'loongport',
      namespace: 'loongport',
      method: 'saveApiKey',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: saveApiKeyInput }],
      result: voidResult,
    },
    {
      id: 'loongport#loongport/clearApiKey',
      service: 'loongport',
      namespace: 'loongport',
      method: 'clearApiKey',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: siteInput }],
      result: voidResult,
    },
    {
      id: 'loongport#loongport/describeApiKey',
      service: 'loongport',
      namespace: 'loongport',
      method: 'describeApiKey',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: siteInput }],
      result: describeApiKeyResult,
    },
  ],
} satisfies TypertRemoteContribution

export default TYPERT_REMOTE
