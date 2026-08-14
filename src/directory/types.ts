export type DirectoryModel = {
  id: string
  default?: true
}

export type DirectoryAuthorization = {
  kind: 'manual-api-key'
}

export type DirectorySite = {
  id: string
  displayName: string
  origin: string
  entryUrl: string
  apiBaseUrl?: string
  inviteCode?: string
  models: DirectoryModel[]
  sponsorship?: { label: string; url: string }
  veridropHosts: string[]
  authorization?: DirectoryAuthorization
  disabled?: boolean
}

export type DirectoryV2 = {
  schemaVersion: 2
  issuedAt: string
  sites: DirectorySite[]
}

export type VeriDropObservation = {
  veridropHost: string
  rank: number | null
  score: number | null
  samples: number | null
  observedAt: string | null
  reportUrl: string | null
  issues: string[]
}

export type ObservationFeedV1 = {
  schemaVersion: 1
  sourceUrl: string
  fetchedAt: string
  observations: VeriDropObservation[]
}

export type SiteView = DirectorySite & {
  observation?: VeriDropObservation
}
