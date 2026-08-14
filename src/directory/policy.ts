import type { DirectoryAuthorization, DirectoryModel, DirectorySite, DirectoryV2 } from './types.js'

export const DIRECTORY_URL = 'https://config.loongport.dev/v2/directory.json'
export const DIRECTORY_SIGNATURE_URL = `${DIRECTORY_URL}.sig`

/** The public half of LoongPort's offline Ed25519 signing key. */
export const DIRECTORY_PUBLIC_KEY_HEX = '3e199ad0082b525fdf8edef5f7161270675e107fd81d31dbce1b71d83936a131'

const decoder = new TextDecoder()

function failDirectory(): never {
  throw new Error('LoongPort provider directory is unavailable')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function absoluteHttpsUrl(value: unknown): string | undefined {
  const candidate = string(value)
  if (candidate === undefined) return undefined
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' && url.hostname !== '' && url.username === '' && url.password === ''
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

function hostname(value: unknown): string | undefined {
  const candidate = string(value)
  if (candidate === undefined) return undefined
  try {
    const host = new URL(`https://${candidate}`).hostname.toLowerCase().replace(/^www\./, '')
    return host === '' ? undefined : host
  } catch {
    return undefined
  }
}

function issuedAt(value: unknown): string | undefined {
  const candidate = string(value)
  if (candidate === undefined || !Number.isFinite(Date.parse(candidate))) return undefined
  return candidate
}

function model(value: unknown): DirectoryModel | undefined {
  if (!isRecord(value)) return undefined
  const id = string(value.id)
  if (id === undefined || (value.default !== undefined && value.default !== true)) return undefined
  return value.default === true ? { id, default: true } : { id }
}

function authorization(value: unknown): DirectoryAuthorization | undefined {
  return isRecord(value) && value.kind === 'manual-api-key' ? { kind: 'manual-api-key' } : undefined
}

export function normalizeSiteIdentifier(id: string): { route: string; credentialRef: string } {
  const slug = id.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (slug === '') failDirectory()
  return {
    route: `loongport-${slug}`,
    credentialRef: `LOONGPORT_${slug.toUpperCase().replaceAll('-', '_')}_API_KEY`,
  }
}

function site(value: unknown): DirectorySite | undefined {
  if (!isRecord(value)) return undefined
  const id = string(value.id)
  const displayName = string(value.displayName)
  const origin = absoluteHttpsUrl(value.origin)
  const entryUrl = absoluteHttpsUrl(value.entryUrl)
  if (id === undefined || displayName === undefined || origin === undefined || entryUrl === undefined) return undefined
  try {
    normalizeSiteIdentifier(id)
  } catch {
    return undefined
  }
  const apiBaseUrl = value.apiBaseUrl === undefined ? undefined : absoluteHttpsUrl(value.apiBaseUrl)
  const inviteCode = value.inviteCode === undefined ? undefined : string(value.inviteCode)
  const disabled = value.disabled === undefined ? undefined : value.disabled === true ? true : value.disabled === false ? false : undefined
  if ((value.apiBaseUrl !== undefined && apiBaseUrl === undefined)
    || (value.inviteCode !== undefined && inviteCode === undefined)
    || (value.disabled !== undefined && disabled === undefined)
    || !Array.isArray(value.models)
    || !Array.isArray(value.veridropHosts)) return undefined
  const models = value.models.map(model)
  const hosts = value.veridropHosts.map(hostname)
  if (models.some((entry) => entry === undefined) || hosts.some((entry) => entry === undefined)) return undefined
  const typedModels = models as DirectoryModel[]
  const typedHosts = hosts as string[]
  if (new Set(typedModels.map(({ id: modelId }) => modelId)).size !== typedModels.length
    || new Set(typedHosts).size !== typedHosts.length) return undefined
  const rawAuthorization = value.authorization
  const typedAuthorization = rawAuthorization === undefined ? undefined : authorization(rawAuthorization)
  if (rawAuthorization !== undefined && typedAuthorization === undefined) return undefined
  if (typedAuthorization?.kind === 'manual-api-key' && disabled !== true
    && (apiBaseUrl === undefined || typedModels.filter(({ default: isDefault }) => isDefault).length !== 1)) return undefined
  let sponsorship: DirectorySite['sponsorship']
  if (value.sponsorship !== undefined) {
    if (!isRecord(value.sponsorship)) return undefined
    const label = string(value.sponsorship.label)
    const url = absoluteHttpsUrl(value.sponsorship.url)
    if (label === undefined || url === undefined) return undefined
    sponsorship = { label, url }
  }
  return {
    id,
    displayName,
    origin,
    entryUrl,
    ...(apiBaseUrl === undefined ? {} : { apiBaseUrl }),
    ...(inviteCode === undefined ? {} : { inviteCode }),
    models: typedModels,
    ...(sponsorship === undefined ? {} : { sponsorship }),
    veridropHosts: typedHosts,
    ...(typedAuthorization === undefined ? {} : { authorization: typedAuthorization }),
    ...(disabled === undefined ? {} : { disabled }),
  }
}

export function validateDirectory(value: unknown): DirectoryV2 {
  if (!isRecord(value) || value.schemaVersion !== 2 || !Array.isArray(value.sites)) return failDirectory()
  const timestamp = issuedAt(value.issuedAt)
  const sites = value.sites.map(site)
  if (timestamp === undefined || sites.some((entry) => entry === undefined)) return failDirectory()
  const typedSites = sites as DirectorySite[]
  const ids = new Set(typedSites.map(({ id }) => id))
  const routes = new Set(typedSites.map(({ id }) => normalizeSiteIdentifier(id).route))
  if (ids.size !== typedSites.length || routes.size !== typedSites.length) return failDirectory()
  return { schemaVersion: 2, issuedAt: timestamp, sites: typedSites }
}

function bytesFromHex(value: string): Uint8Array {
  return Uint8Array.from(value.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)))
}

async function verifyDirectory(bytes: ArrayBuffer, signature: ArrayBuffer): Promise<boolean> {
  if (signature.byteLength !== 64 || globalThis.crypto?.subtle === undefined) return false
  try {
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      bytesFromHex(DIRECTORY_PUBLIC_KEY_HEX).buffer as ArrayBuffer,
      { name: 'Ed25519' },
      false,
      ['verify'],
    )
    return await globalThis.crypto.subtle.verify({ name: 'Ed25519' }, key, signature, bytes)
  } catch {
    return false
  }
}

export async function loadVerifiedDirectory(fetcher: typeof fetch): Promise<DirectoryV2> {
  try {
    const [directoryResponse, signatureResponse] = await Promise.all([
      fetcher(DIRECTORY_URL),
      fetcher(DIRECTORY_SIGNATURE_URL),
    ])
    if (!directoryResponse.ok || !signatureResponse.ok) return failDirectory()
    const [bytes, signature] = await Promise.all([directoryResponse.arrayBuffer(), signatureResponse.arrayBuffer()])
    if (!await verifyDirectory(bytes, signature)) return failDirectory()
    return validateDirectory(JSON.parse(decoder.decode(bytes)) as unknown)
  } catch {
    return failDirectory()
  }
}
