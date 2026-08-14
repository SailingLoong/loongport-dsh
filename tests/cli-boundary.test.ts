import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const sentinel = 'api-key-sentinel-must-not-appear'
let temporaryRoot: string
let binPath: string
let packageFiles: string[]

beforeAll(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'loongport-package-'))
  const packResult = spawnSync('npm', [
    'pack',
    '--ignore-scripts',
    '--json',
    '--silent',
    '--pack-destination',
    temporaryRoot,
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
  })

  expect(packResult.status, packResult.stderr).toBe(0)
  const packageDescription = JSON.parse(packResult.stdout) as Array<{
    filename: string
    files: Array<{ path: string }>
  }>
  const packagePath = join(temporaryRoot, packageDescription[0].filename)
  packageFiles = packageDescription[0].files.map(({ path }) => path).sort()
  const installPrefix = join(temporaryRoot, 'install')
  const installResult = spawnSync('npm', ['install', '--prefix', installPrefix, packagePath], {
    cwd: temporaryRoot,
    encoding: 'utf8',
  })

  expect(installResult.status, installResult.stderr).toBe(0)
  binPath = join(installPrefix, 'node_modules', '.bin', 'loongport')
})

afterAll(async () => {
  await rm(temporaryRoot, { recursive: true, force: true })
})

function runInstalledCli(args: string[], dshHome = join(temporaryRoot, 'dsh-home')) {
  return spawnSync(binPath, args, {
    cwd: temporaryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      DSH_HOME: dshHome,
      LOONGPORT_API_KEY: sentinel,
    },
  })
}

describe('loongport CLI boundary', () => {
  it('does not echo values passed to an API-key-like option', () => {
    const result = runInstalledCli([
      'dsh',
      'setup',
      '--base-url',
      'https://example.com/v1',
      '--model',
      'model-a',
      `--api-key=${sentinel}`,
    ])

    expect(result.status).not.toBe(0)
    expect(result.stdout).not.toContain(sentinel)
    expect(result.stderr).not.toContain(sentinel)
  })

  it('ships only the public package allowlist and runs through the installed executable', () => {
    expect(packageFiles).toEqual([
      'LICENSE',
      'README.md',
      'cordis.patch.yml',
      'dist/cli.js',
      'dist/client/index.js',
      'dist/host/index.js',
      'dist/index.js',
      'package.json',
    ])

    const result = runInstalledCli([
      'dsh',
      'setup',
      '--base-url',
      'https://example.com/v1',
      '--route',
      'loongport-test',
      '--credential-name',
      'LOONGPORT_TEST_KEY',
      '--model',
      'model-a',
      '--model',
      'model-b',
    ])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('loongport setup plan:')
    expect(result.stdout).toContain('route: loongport-test')
    expect(result.stdout).toContain('base URL: https://example.com/v1')
    expect(result.stdout).toContain('models:\n    - model-a\n    - model-b')
    expect(result.stdout).toContain('credential reference: LOONGPORT_TEST_KEY')
    expect(result.stdout).toContain(`settings path: ${join(temporaryRoot, 'dsh-home', 'settings.yaml')}`)
    expect(result.stdout).toContain(`credentials path: ${join(temporaryRoot, 'dsh-home', '.credentials.yaml')}`)
    expect(result.stdout).toContain('written: false')
    expect(result.stdout).not.toContain(sentinel)
    expect(result.stderr).toBe('')
  })

  it.each([
    ['empty route', ['--route', '']],
    ['empty model', ['--model', '']],
    ['duplicate models', ['--model', 'model-a', '--model', 'model-a']],
    ['invalid credential reference', ['--credential-name', 'INVALID-NAME']],
  ])('rejects an %s before touching DSH files', async (_name, invalidArgs) => {
    const dshHome = join(temporaryRoot, `invalid-input-${_name.replaceAll(' ', '-')}`)
    const settingsPath = join(dshHome, 'settings.yaml')
    const credentialsPath = join(dshHome, '.credentials.yaml')
    const originalSettings = 'unrelated: keep\n'
    const originalCredentials = 'EXISTING: keep\n'
    await mkdir(dshHome, { recursive: true })
    await writeFile(settingsPath, originalSettings)
    await writeFile(credentialsPath, originalCredentials)
    const modelArgs = invalidArgs.includes('--model') ? [] : ['--model', 'model-a']

    const result = runInstalledCli([
      'dsh',
      'setup',
      '--base-url',
      'https://example.com/v1',
      ...modelArgs,
      ...invalidArgs,
      '--write',
    ], dshHome)

    expect(result.status).not.toBe(0)
    expect(result.stdout).not.toContain(sentinel)
    expect(result.stderr).not.toContain(sentinel)
    await expect(readFile(settingsPath, 'utf8')).resolves.toBe(originalSettings)
    await expect(readFile(credentialsPath, 'utf8')).resolves.toBe(originalCredentials)
  })

  it('reports malformed credentials YAML as an application failure without exposing secrets', async () => {
    const dshHome = join(temporaryRoot, 'malformed-yaml-home')
    await mkdir(dshHome, { recursive: true })
    await writeFile(join(dshHome, 'settings.yaml'), 'unrelated: keep\n')
    await writeFile(join(dshHome, '.credentials.yaml'), `EXISTING: [${sentinel}\n`)

    const result = runInstalledCli([
      'dsh',
      'setup',
      '--base-url',
      'https://example.com/v1',
      '--model',
      'model-a',
      '--write',
    ], dshHome)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('credentials YAML is invalid; fix the file and retry')
    expect(result.stdout).not.toContain(sentinel)
    expect(result.stderr).not.toContain(sentinel)
    await expect(readFile(join(dshHome, 'settings.yaml'), 'utf8')).resolves.toBe('unrelated: keep\n')
  })

  it('reports a filesystem preparation failure without exposing secrets or paths', async () => {
    const dshHome = join(temporaryRoot, `not-a-directory-${sentinel}`)
    await writeFile(dshHome, 'blocking file')

    const result = runInstalledCli([
      'dsh',
      'setup',
      '--base-url',
      'https://example.com/v1',
      '--model',
      'model-a',
      '--write',
    ], dshHome)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('could not prepare the DSH directory; check its permissions and retry')
    expect(result.stdout).not.toContain(sentinel)
    expect(result.stderr).not.toContain(sentinel)
  })
})
