import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

describe('loongport CLI boundary', () => {
  it('does not echo values passed to an API-key-like option', () => {
    const sentinel = 'api-key-sentinel-must-not-appear'
    const result = spawnSync(process.execPath, [
      'dist/cli.js',
      'dsh',
      'setup',
      '--base-url',
      'https://example.com/v1',
      '--model',
      'model-a',
      `--api-key=${sentinel}`,
    ], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).not.toContain(sentinel)
  })
})
