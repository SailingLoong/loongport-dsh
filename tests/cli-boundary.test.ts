import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

  it('runs when invoked through a bin symlink', async () => {
    const binDirectory = await mkdtemp(join(tmpdir(), 'loongport-bin-'))
    const binPath = join(binDirectory, 'loongport')

    try {
      await symlink(join(projectRoot, 'dist', 'cli.js'), binPath)
      const result = spawnSync(process.execPath, [
        binPath,
        'dsh',
        'setup',
        '--base-url',
        'https://example.com/v1',
        '--model',
        'model-a',
      ], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: { ...process.env, LOONGPORT_API_KEY: 'test' },
      })

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('dry run')
    } finally {
      await rm(binDirectory, { recursive: true, force: true })
    }
  })
})
