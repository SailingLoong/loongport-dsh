import { describe, expect, it } from 'vitest'

import { parseSetupOptions } from '../src/options.js'

describe('parseSetupOptions', () => {
  it('rejects a base URL using a non-HTTP scheme', () => {
    expect(() => parseSetupOptions(['dsh', 'setup', '--base-url', 'ftp://example.com', '--model', 'm'], {}))
      .toThrow('base URL must use http or https')
  })

  it('requires the API key from the environment', () => {
    expect(() => parseSetupOptions(['dsh', 'setup', '--base-url', 'https://example.com/v1', '--model', 'm'], {}))
      .toThrow('LOONGPORT_API_KEY is required')
  })

  it('rejects a URL that embeds credentials', () => {
    expect(() => parseSetupOptions([
      'dsh',
      'setup',
      '--base-url',
      'https://key@example.com/v1',
      '--model',
      'm',
    ], { LOONGPORT_API_KEY: 'test-key' }))
      .toThrow('base URL must not include credentials')
  })

  it('requires at least one model', () => {
    expect(() => parseSetupOptions(['dsh', 'setup', '--base-url', 'https://example.com/v1'], {
      LOONGPORT_API_KEY: 'test-key',
    })).toThrow('at least one --model is required')
  })

  it.each([
    {
      name: 'an empty route',
      argv: ['--route', ''],
      message: 'route must not be empty',
    },
    {
      name: 'an empty model identifier',
      argv: ['--model', ''],
      message: 'model identifiers must not be empty',
    },
    {
      name: 'duplicate model identifiers',
      argv: ['--model', 'model-a', '--model', 'model-a'],
      message: 'model identifiers must be unique',
    },
    {
      name: 'an invalid credential reference',
      argv: ['--credential-name', 'INVALID-NAME'],
      message: 'credential name must be an environment variable name',
    },
  ])('rejects $name', ({ argv, message }) => {
    const modelArgs = argv.includes('--model') ? [] : ['--model', 'model-a']

    expect(() => parseSetupOptions([
      'dsh',
      'setup',
      '--base-url',
      'https://example.com/v1',
      ...modelArgs,
      ...argv,
    ], { LOONGPORT_API_KEY: 'test-key' })).toThrow(message)
  })

  it('normalizes the base URL and applies setup defaults', () => {
    expect(parseSetupOptions([
      'dsh',
      'setup',
      '--base-url',
      'https://example.com/v1/',
      '--model',
      'model-a',
      '--model',
      'model-b',
    ], {
      DSH_HOME: '/tmp/dsh-home',
      LOONGPORT_API_KEY: 'test-key',
    })).toEqual({
      baseUrl: 'https://example.com/v1',
      route: 'loongport',
      credentialName: 'LOONGPORT_API_KEY',
      models: ['model-a', 'model-b'],
      dshHome: '/tmp/dsh-home',
      write: false,
      apiKey: 'test-key',
    })
  })
})
