import { describe, expect, it, vi } from 'vitest'

import { createLoongPortHost } from '../src/host/index.js'

describe('createLoongPortHost', () => {
  it('does not read an undeclared fetcher property from the Cordis context', () => {
    const context = new Proxy({
      credentials: {
        async set() {},
        async unset() {},
        async describe() { return { configured: false, writable: true } },
      },
      settings: { async mutate() {} },
    }, {
      get(target, property, receiver) {
        if (property === 'fetcher') throw new Error('fetcher must be an explicit dependency')
        return Reflect.get(target, property, receiver)
      },
    })

    expect(() => createLoongPortHost(context as never, vi.fn() as never)).not.toThrow()
  })
})
