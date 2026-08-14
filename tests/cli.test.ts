import * as nodeFileSystem from 'node:fs/promises'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseDocument } from 'yaml'
import { afterEach, describe, expect, it } from 'vitest'

import { runSetup } from '../src/cli.js'
import { applySetup } from '../src/files.js'
import type { SetupOptions } from '../src/options.js'

const homes: string[] = []
const apiKey = 'api-key-sentinel-must-not-appear'

async function createHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'loongport-dsh-'))
  homes.push(home)
  return home
}

function setupOptions(dshHome: string, write = false): SetupOptions {
  return {
    baseUrl: 'https://relay.example.com/v1',
    route: 'loongport',
    credentialName: 'LOONGPORT_API_KEY',
    models: ['model-a'],
    dshHome,
    write,
    apiKey,
  }
}

afterEach(async () => {
  await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

describe('DSH setup runner', () => {
  it('leaves the DSH home untouched during a redacted dry run', async () => {
    const home = await createHome()
    const options = setupOptions(join(home, '.dsh'))

    const result = await runSetup(options)

    expect(result).toMatchObject({ written: false })
    expect(JSON.stringify(result)).not.toContain(apiKey)
    await expect(readFile(join(options.dshHome, 'settings.yaml'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(options.dshHome, '.credentials.yaml'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })

    await expect(runSetup({ ...options, write: true })).resolves.toMatchObject({ written: true })
    await expect(readFile(join(options.dshHome, 'settings.yaml'), 'utf8')).resolves.toContain('api: openai-completions')
  })

  it('writes merged DSH files with owner-only credentials when explicitly requested', async () => {
    const home = await createHome()
    const dshHome = join(home, '.dsh')
    await mkdir(dshHome, { recursive: true })
    await writeFile(join(dshHome, 'settings.yaml'), 'unrelated: keep\nllm-pi-ai:\n  providers:\n    openai:\n      displayName: OpenAI\n')
    await writeFile(join(dshHome, '.credentials.yaml'), 'EXISTING_SECRET: keep\n', { mode: 0o644 })

    const result = await runSetup(setupOptions(dshHome, true))

    expect(result).toMatchObject({
      written: true,
      settingsPath: join(dshHome, 'settings.yaml'),
      credentialsPath: join(dshHome, '.credentials.yaml'),
    })
    expect(JSON.stringify(result)).not.toContain(apiKey)
    expect(parseDocument(await readFile(join(dshHome, 'settings.yaml'), 'utf8')).toJS()).toMatchObject({
      unrelated: 'keep',
      'llm-pi-ai': {
        providers: {
          openai: { displayName: 'OpenAI' },
          loongport: { api: 'openai-completions' },
        },
      },
    })
    expect(parseDocument(await readFile(join(dshHome, '.credentials.yaml'), 'utf8')).toJS()).toEqual({
      EXISTING_SECRET: 'keep',
      LOONGPORT_API_KEY: apiKey,
    })
    expect((await stat(join(dshHome, '.credentials.yaml'))).mode & 0o777).toBe(0o600)
  })

  it('renders both documents before changing either file', async () => {
    const home = await createHome()
    const dshHome = join(home, '.dsh')
    const settingsPath = join(dshHome, 'settings.yaml')
    const credentialsPath = join(dshHome, '.credentials.yaml')
    const originalSettings = 'unrelated: keep\n'
    const malformedCredentials = `EXISTING: [${apiKey}\n`
    await mkdir(dshHome, { recursive: true })
    await writeFile(settingsPath, originalSettings)
    await writeFile(credentialsPath, malformedCredentials)

    await expect(runSetup(setupOptions(dshHome, true))).rejects.toThrow()

    await expect(readFile(settingsPath, 'utf8')).resolves.toBe(originalSettings)
    await expect(readFile(credentialsPath, 'utf8')).resolves.toBe(malformedCredentials)
  })

  it('does not activate a provider route when credentials staging fails', async () => {
    const home = await createHome()
    const dshHome = join(home, '.dsh')
    const settingsPath = join(dshHome, 'settings.yaml')
    await mkdir(dshHome, { recursive: true })
    await writeFile(settingsPath, 'unrelated: keep\n')
    let stagingCalls = 0
    const failingFileSystem = {
      ...nodeFileSystem,
      writeFile: async (...args: Parameters<typeof nodeFileSystem.writeFile>) => {
        stagingCalls += 1
        if (stagingCalls === 2) {
          throw new Error(`injected staging failure: ${apiKey}`)
        }

        return nodeFileSystem.writeFile(...args)
      },
    }

    await expect(applySetup(setupOptions(dshHome, true), failingFileSystem)).rejects.toThrow()

    expect(parseDocument(await readFile(settingsPath, 'utf8')).toJS()).not.toHaveProperty(
      'llm-pi-ai.providers.loongport',
    )
  })

  it('commits credentials before settings so a second rename failure cannot activate a provider route', async () => {
    const home = await createHome()
    const dshHome = join(home, '.dsh')
    const settingsPath = join(dshHome, 'settings.yaml')
    await mkdir(dshHome, { recursive: true })
    await writeFile(settingsPath, 'unrelated: keep\n')
    let renameCalls = 0
    const failingFileSystem = {
      ...nodeFileSystem,
      rename: async (...args: Parameters<typeof nodeFileSystem.rename>) => {
        renameCalls += 1
        if (renameCalls === 2) {
          throw new Error(`injected rename failure: ${apiKey}`)
        }

        return nodeFileSystem.rename(...args)
      },
    }

    await expect(applySetup(setupOptions(dshHome, true), failingFileSystem)).rejects.toThrow()

    expect(parseDocument(await readFile(settingsPath, 'utf8')).toJS()).not.toHaveProperty(
      'llm-pi-ai.providers.loongport',
    )
  })
})
