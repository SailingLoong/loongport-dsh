import { describe, expect, it, vi } from 'vitest'

import { apply } from '../src/client/index.js'
import { inject as hostInject } from '../src/host/index.js'

type SettingsSectionRegistration = {
  name: 'settings.section'
  inject(): {
    subscribeInvalidations(listener: () => void): () => void
  }
}

function context() {
  const remoteDispose = vi.fn(async () => undefined)
  const credentialsDispose = vi.fn()
  const resetDispose = vi.fn()
  const effectDisposers: unknown[] = []
  let sectionRegistration: SettingsSectionRegistration | undefined
  const register = vi.fn((options: SettingsSectionRegistration) => {
    if (options.name === 'settings.section') sectionRegistration = options
    return vi.fn()
  })
  const slots = {
    inject: vi.fn((_name: string, factory: () => unknown) => {
      factory()
      return vi.fn()
    }),
    register,
  }
  const ctx = {
    effect: vi.fn((callback: () => unknown) => {
      const disposer = callback()
      effectDisposers.push(disposer)
      return vi.fn()
    }),
    locale: {
      bind: vi.fn(() => (key: string) => key),
      register: vi.fn(() => vi.fn()),
    },
    on: vi.fn(() => resetDispose),
    remote: {
      $mount: vi.fn(async () => remoteDispose),
      $on: vi.fn(() => credentialsDispose),
    },
    slots,
  }
  return {
    ctx,
    effectDisposers,
    remoteDispose,
    credentialsDispose,
    resetDispose,
    slots,
    sectionRegistration: () => sectionRegistration,
  }
}

describe('LoongPort client and host entries', () => {
  it('mounts the LoongPort Remote contribution without global refresh listeners', async () => {
    const { ctx, effectDisposers, remoteDispose, slots } = context()

    await apply(ctx as never)

    expect(ctx.remote.$mount).toHaveBeenCalledWith(expect.objectContaining({
      package: 'loongport',
      descriptors: expect.any(Array),
    }))
    expect(effectDisposers).toContain(remoteDispose)
    expect(ctx.remote.$on).not.toHaveBeenCalled()
    expect(ctx.on).not.toHaveBeenCalled()
    expect(slots.inject).toHaveBeenCalledWith('settings.section', expect.any(Function))
    expect(slots.inject).not.toHaveBeenCalledWith('settings.onboarding', expect.any(Function))
  })

  it('waits for the services captured by the host Remote service', () => {
    expect(hostInject).toEqual(['credentials', 'settings'])
  })

  it('provides refresh subscriptions for the mounted section to dispose', async () => {
    const { credentialsDispose, ctx, resetDispose, sectionRegistration } = context()

    await apply(ctx as never)

    const section = sectionRegistration()
    expect(section).toBeDefined()
    const injected = section?.inject()
    expect(injected).toBeDefined()
    if (injected === undefined) throw new Error('settings section injection is unavailable')
    const dispose = injected.subscribeInvalidations(vi.fn())

    expect(ctx.on).toHaveBeenCalledWith('connection/reset', expect.any(Function))
    expect(ctx.remote.$on).toHaveBeenCalledWith('credentials/updated', expect.any(Function))
    dispose()
    expect(resetDispose).toHaveBeenCalledOnce()
    expect(credentialsDispose).toHaveBeenCalledOnce()
  })
})
