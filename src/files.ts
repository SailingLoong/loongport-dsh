import * as nodeFileSystem from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { mergeCredentials, mergeSettings } from './dsh-config.js'
import type { SetupOptions } from './options.js'

export interface SetupResult {
  written: boolean
  settingsPath: string
  credentialsPath: string
}

export type FileSystem = Pick<
  typeof nodeFileSystem,
  'chmod' | 'mkdir' | 'readFile' | 'rename' | 'rm' | 'writeFile'
>

export class SetupApplicationError extends Error {}

function applicationError(message: string, cause: unknown): SetupApplicationError {
  return new SetupApplicationError(message, { cause })
}

async function readDocument(
  path: string,
  name: 'settings' | 'credentials',
  fileSystem: FileSystem,
): Promise<string> {
  try {
    return await fileSystem.readFile(path, 'utf8')
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return ''
    }

    throw applicationError(`could not read DSH ${name}; check file permissions and retry`, error)
  }
}

async function stageFile(
  path: string,
  text: string,
  fileSystem: FileSystem,
  mode?: number,
): Promise<string> {
  const temporaryPath = join(dirname(path), `.${randomUUID()}.tmp`)

  try {
    await fileSystem.writeFile(temporaryPath, text, mode === undefined ? undefined : { mode })
    if (mode !== undefined) {
      await fileSystem.chmod(temporaryPath, mode)
    }

    return temporaryPath
  } catch (error) {
    await fileSystem.rm(temporaryPath, { force: true })
    throw error
  }
}

function renderDocument(name: 'settings' | 'credentials', render: () => string): string {
  try {
    return render()
  } catch (error) {
    throw applicationError(`${name} YAML is invalid; fix the file and retry`, error)
  }
}

export async function applySetup(
  options: SetupOptions,
  fileSystem: FileSystem = nodeFileSystem,
): Promise<SetupResult> {
  const settingsPath = join(options.dshHome, 'settings.yaml')
  const credentialsPath = join(options.dshHome, '.credentials.yaml')

  if (!options.write) {
    return { written: false, settingsPath, credentialsPath }
  }

  try {
    await fileSystem.mkdir(options.dshHome, { recursive: true })
  } catch (error) {
    throw applicationError('could not prepare the DSH directory; check its permissions and retry', error)
  }

  const [settings, credentials] = await Promise.all([
    readDocument(settingsPath, 'settings', fileSystem),
    readDocument(credentialsPath, 'credentials', fileSystem),
  ])

  const renderedSettings = renderDocument('settings', () => mergeSettings(settings, options))
  const renderedCredentials = renderDocument('credentials', () => mergeCredentials(credentials, options))
  let stagedSettingsPath: string | undefined
  let stagedCredentialsPath: string | undefined

  try {
    try {
      stagedSettingsPath = await stageFile(settingsPath, renderedSettings, fileSystem)
    } catch (error) {
      throw applicationError('could not stage DSH settings; check directory permissions and retry', error)
    }

    try {
      stagedCredentialsPath = await stageFile(credentialsPath, renderedCredentials, fileSystem, 0o600)
    } catch (error) {
      throw applicationError('could not stage DSH credentials; check directory permissions and retry', error)
    }

    try {
      await fileSystem.rename(stagedCredentialsPath, credentialsPath)
      stagedCredentialsPath = undefined
    } catch (error) {
      throw applicationError('could not commit DSH credentials; check directory permissions and retry', error)
    }

    try {
      await fileSystem.rename(stagedSettingsPath, settingsPath)
      stagedSettingsPath = undefined
    } catch (error) {
      throw applicationError('could not activate DSH settings; check directory permissions and retry', error)
    }
  } finally {
    await Promise.allSettled([
      stagedSettingsPath === undefined
        ? Promise.resolve()
        : fileSystem.rm(stagedSettingsPath, { force: true }),
      stagedCredentialsPath === undefined
        ? Promise.resolve()
        : fileSystem.rm(stagedCredentialsPath, { force: true }),
    ])
  }

  return { written: true, settingsPath, credentialsPath }
}
