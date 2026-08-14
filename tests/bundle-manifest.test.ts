import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
let temporaryRoot: string

beforeAll(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'loongport-bundle-'))
})

afterAll(async () => {
  await rm(temporaryRoot, { recursive: true, force: true })
})

describe('LoongPort DSH bundle manifest', () => {
  it('declares a root client bundle and an isolated host entry', async () => {
    const manifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      dsh?: { bundle?: { patch?: string }; client?: { platform?: string; inject?: string[] } }
    }

    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh?.client).toMatchObject({
      platform: 'web',
      inject: expect.arrayContaining([
        '@deepseek-ai/dsh-client-runtime',
        '@deepseek-ai/dsh-client-ui-settings',
        '@deepseek-ai/dsh-client-locale',
        '@deepseek-ai/dsh-api-remotes',
      ]),
    })
    expect(manifest.dependencies).toMatchObject({
      '@deepseek-ai/cordis': '4.0.1',
      '@deepseek-ai/dsh-brand': '0.1.0-rc.6',
      '@deepseek-ai/dsh-credentials': '0.1.0-rc.6',
      '@deepseek-ai/dsh-invariants': '0.1.0-rc.6',
      '@deepseek-ai/dsh-settings': '0.1.0-rc.6',
      '@deepseek-ai/dsh-typert-protocol': '0.1.0-rc.6',
      '@deepseek-ai/schemastery': '^3.18.1',
    })

    const patch = parse(await readFile(join(projectRoot, 'cordis.patch.yml'), 'utf8')) as Array<{
      insert?: Array<{ id: string; name: string }>
    }>
    expect(patch).toEqual([{
      insert: [
        { id: 'loongport', name: 'loongport' },
        { id: 'loongport-host', name: 'loongport/host' },
      ],
    }])
  })

  it('ships the bundle patch and every referenced package artifact', () => {
    const pack = spawnSync('npm', ['pack', '--ignore-scripts', '--json', '--silent', '--pack-destination', temporaryRoot], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(pack.status, pack.stderr).toBe(0)
    const files = (JSON.parse(pack.stdout) as Array<{ files: Array<{ path: string }> }>)[0].files
      .map(({ path }) => path)
      .sort()

    expect(files).toEqual(expect.arrayContaining([
      'LICENSE',
      'README.md',
      'cordis.patch.yml',
      'dist/client/index.js',
      'dist/host/index.js',
    ]))
    expect(files.some((path) => path.startsWith('docs/maintainers/'))).toBe(false)
    expect(files.some((path) => path.startsWith('tests/'))).toBe(false)
    expect(files.some((path) => path.includes('signing'))).toBe(false)
  })
})
