import { Buffer } from 'node:buffer'

import { describe, expect, it } from 'vitest'

import { DIRECTORY_SIGNATURE_URL, DIRECTORY_URL, loadVerifiedDirectory, validateDirectory } from '../src/directory/policy.js'

const SIGNATURE = Buffer.from(
  '0SZB2nbQ5JAi5a+MduMonMbHbRjk+8CERlZ+Uky+5tyhfOh7703Ejj/nrCGpHip7mTq0fIWJV/e3aAIqXypvAw==',
  'base64',
)

const POLICY = Buffer.from(
  'ewogICJzY2hlbWFWZXJzaW9uIjogMiwKICAiaXNzdWVkQXQiOiAiMjAyNi0wOC0xNFQwMDowMDowMFoiLAogICJzaXRlcyI6IFsKICAgIHsKICAgICAgImlkIjogImJlc3RhcGkiLAogICAgICAiZGlzcGxheU5hbWUiOiAiQmVzdEFQSSIsCiAgICAgICJvcmlnaW4iOiAiaHR0cHM6Ly9hcGkuYmVzdGFwaS5zdG9yZSIsCiAgICAgICJlbnRyeVVybCI6ICJodHRwczovL2FwaS5iZXN0YXBpLnN0b3JlLyIsCiAgICAgICJhcGlCYXNlVXJsIjogImh0dHBzOi8vYXBpLmJlc3RhcGkuc3RvcmUvdjEiLAogICAgICAibW9kZWxzIjogWwogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJkZWVwc2Vlay12NC1mbGFzaCIsCiAgICAgICAgICAiZGVmYXVsdCI6IHRydWUKICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJkZWVwc2Vlay12NC1wcm8iCiAgICAgICAgfQogICAgICBdLAogICAgICAidmVyaWRyb3BIb3N0cyI6IFsKICAgICAgICAiYXBpLmJlc3RhcGkuc3RvcmUiCiAgICAgIF0sCiAgICAgICJhdXRob3JpemF0aW9uIjogewogICAgICAgICJraW5kIjogIm1hbnVhbC1hcGkta2V5IgogICAgICB9CiAgICB9CiAgXQp9Cg==',
  'base64',
)

function response(bytes: Uint8Array): Response {
  return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
}

function fetchDirectory(body: Uint8Array = POLICY, signature: Uint8Array = SIGNATURE): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input)
    if (url === DIRECTORY_URL) return response(body)
    if (url === DIRECTORY_SIGNATURE_URL) return response(signature)
    throw new Error(`unexpected fetch: ${url}`)
  }) as typeof fetch
}

describe('loadVerifiedDirectory', () => {
  it('accepts the production-signed raw policy bytes', async () => {
    await expect(loadVerifiedDirectory(fetchDirectory())).resolves.toMatchObject({
      schemaVersion: 2,
      sites: [{ id: 'bestapi', apiBaseUrl: 'https://api.bestapi.store/v1' }],
    })
  })

  it.each([
    ['altered policy bytes', Buffer.from(POLICY.toString().replace('BestAPI', 'BestAPJ'))],
    ['wrong detached signature', POLICY, new Uint8Array(64)],
    ['invalid policy schema', Buffer.from('{"schemaVersion":2,"issuedAt":"bad","sites":[]}')],
  ])('rejects %s', async (_caseName, body, signature = SIGNATURE) => {
    await expect(loadVerifiedDirectory(fetchDirectory(body, signature))).rejects.toThrow()
  })

  it('rejects an invalid policy schema after verification parsing', () => {
    expect(() => validateDirectory({ schemaVersion: 2, issuedAt: 'invalid', sites: [] })).toThrow()
  })
})
