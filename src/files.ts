import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { mergeCredentials, mergeSettings } from './dsh-config.js'
import type { SetupOptions } from './options.js'

export interface SetupResult {
  written: boolean
  settingsPath: string
  credentialsPath: string
}

async function readDocument(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8')
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return ''
    }

    throw error
  }
}

async function writeAtomically(path: string, text: string, mode?: number): Promise<void> {
  const temporaryPath = join(dirname(path), `.${randomUUID()}.tmp`)

  try {
    await writeFile(temporaryPath, text, mode === undefined ? undefined : { mode })
    if (mode !== undefined) {
      await chmod(temporaryPath, mode)
    }
    await rename(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

export async function applySetup(options: SetupOptions): Promise<SetupResult> {
  const settingsPath = join(options.dshHome, 'settings.yaml')
  const credentialsPath = join(options.dshHome, '.credentials.yaml')

  if (!options.write) {
    return { written: false, settingsPath, credentialsPath }
  }

  await mkdir(options.dshHome, { recursive: true })

  const [settings, credentials] = await Promise.all([
    readDocument(settingsPath),
    readDocument(credentialsPath),
  ])

  await writeAtomically(settingsPath, mergeSettings(settings, options))
  await writeAtomically(credentialsPath, mergeCredentials(credentials, options), 0o600)

  return { written: true, settingsPath, credentialsPath }
}
