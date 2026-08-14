import type { DirectoryV2, ObservationFeedV1, SiteView, VeriDropObservation } from './types.js'

function normalizeHost(value: string): string | undefined {
  try {
    return new URL(`https://${value}`).hostname.toLowerCase().replace(/^www\./, '') || undefined
  } catch {
    return undefined
  }
}

function displayObservation(observation: VeriDropObservation): VeriDropObservation {
  return {
    veridropHost: observation.veridropHost,
    rank: observation.rank,
    score: observation.score,
    samples: observation.samples,
    observedAt: observation.observedAt,
    reportUrl: observation.reportUrl,
    issues: [...observation.issues],
  }
}

export function mergeSiteViews(directory: DirectoryV2, observations?: ObservationFeedV1): SiteView[] {
  const byHost = new Map<string, VeriDropObservation>()
  for (const observation of observations?.observations ?? []) {
    const host = normalizeHost(observation.veridropHost)
    if (host !== undefined && !byHost.has(host)) byHost.set(host, observation)
  }
  return directory.sites.map((site) => {
    const match = site.veridropHosts.map(normalizeHost).find((host) => host !== undefined && byHost.has(host))
    const observation = match === undefined ? undefined : byHost.get(match)
    return observation === undefined ? { ...site, models: [...site.models], veridropHosts: [...site.veridropHosts] }
      : { ...site, models: [...site.models], veridropHosts: [...site.veridropHosts], observation: displayObservation(observation) }
  })
}
