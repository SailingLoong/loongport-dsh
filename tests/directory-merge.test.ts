import { describe, expect, it } from 'vitest'

import { mergeSiteViews } from '../src/directory/merge.js'
import { loadObservationFeed } from '../src/directory/observations.js'
import type { DirectoryV2, ObservationFeedV1 } from '../src/directory/types.js'

const directory: DirectoryV2 = {
  schemaVersion: 2,
  issuedAt: '2026-08-14T00:00:00Z',
  sites: [{
    id: 'bestapi',
    displayName: 'BestAPI',
    origin: 'https://api.bestapi.store/',
    entryUrl: 'https://api.bestapi.store/',
    apiBaseUrl: 'https://api.bestapi.store/v1',
    models: [{ id: 'deepseek-v4-flash', default: true }, { id: 'deepseek-v4-pro' }],
    veridropHosts: ['api.bestapi.store'],
    authorization: { kind: 'manual-api-key' },
  }],
}

describe('mergeSiteViews', () => {
  it('treats an unavailable observation feed as optional', async () => {
    await expect(loadObservationFeed(async () => { throw new Error('unavailable') }) ).resolves.toBeUndefined()
  })

  it('only copies display-only VeriDrop fields into a nested observation', () => {
    const hostileFeed: ObservationFeedV1 = {
      schemaVersion: 1,
      sourceUrl: 'https://veridrop.org/leaderboard/',
      fetchedAt: '2026-08-14T00:00:00.000Z',
      observations: [{
        veridropHost: 'www.api.bestapi.store',
        rank: 1,
        score: 99,
        samples: 22,
        observedAt: '2026-08-14',
        reportUrl: 'https://veridrop.org/leaderboard/api.bestapi.store',
        issues: ['latency'],
        entryUrl: 'https://attacker.invalid',
        apiBaseUrl: 'https://attacker.invalid/v1',
        models: [{ id: 'attacker-model' }],
        authorization: { kind: 'anything' },
      } as ObservationFeedV1['observations'][number]],
    }

    const [view] = mergeSiteViews(directory, hostileFeed)

    expect(view).toMatchObject({
      entryUrl: 'https://api.bestapi.store/',
      apiBaseUrl: 'https://api.bestapi.store/v1',
      models: [{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }],
      authorization: { kind: 'manual-api-key' },
      observation: { rank: 1, score: 99, samples: 22, issues: ['latency'] },
    })
    expect(view).not.toHaveProperty('observation.entryUrl')
    expect(view).not.toHaveProperty('observation.apiBaseUrl')
    expect(view).not.toHaveProperty('observation.models')
    expect(view).not.toHaveProperty('observation.authorization')
  })
})
