import type { ObservationFeedV1, VeriDropObservation } from './types.js'

export const OBSERVATIONS_URL = 'https://config.loongport.dev/v2/observations.json'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function host(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  try {
    return new URL(`https://${value}`).hostname.toLowerCase().replace(/^www\./, '') || undefined
  } catch {
    return undefined
  }
}

function nullableNumber(value: unknown): number | null | undefined {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0) ? value : undefined
}

function nullableString(value: unknown): string | null | undefined {
  return value === null || typeof value === 'string' ? value : undefined
}

function observation(value: unknown): VeriDropObservation | undefined {
  if (!isRecord(value) || !Array.isArray(value.issues)) return undefined
  const veridropHost = host(value.veridropHost)
  const rank = nullableNumber(value.rank)
  const score = nullableNumber(value.score)
  const samples = nullableNumber(value.samples)
  const observedAt = nullableString(value.observedAt)
  const reportUrl = nullableString(value.reportUrl)
  if (veridropHost === undefined || rank === undefined || score === undefined || samples === undefined
    || observedAt === undefined || reportUrl === undefined || !value.issues.every((issue) => typeof issue === 'string')) return undefined
  return { veridropHost, rank, score, samples, observedAt, reportUrl, issues: [...value.issues] }
}

export function validateObservationFeed(value: unknown): ObservationFeedV1 | undefined {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.sourceUrl !== 'string'
    || typeof value.fetchedAt !== 'string' || !Array.isArray(value.observations)) return undefined
  const observations = value.observations.map(observation)
  if (observations.some((entry) => entry === undefined)) return undefined
  return { schemaVersion: 1, sourceUrl: value.sourceUrl, fetchedAt: value.fetchedAt, observations: observations as VeriDropObservation[] }
}

export async function loadObservationFeed(fetcher: typeof fetch): Promise<ObservationFeedV1 | undefined> {
  try {
    const response = await fetcher(OBSERVATIONS_URL)
    return response.ok ? validateObservationFeed(await response.json()) : undefined
  } catch {
    return undefined
  }
}
