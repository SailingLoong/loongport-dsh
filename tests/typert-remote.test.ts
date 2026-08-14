import { describe, expect, it } from 'vitest'

import { TYPERT_REMOTE } from '../src/client/typert.remote.js'

describe('LoongPort Typert remote contribution', () => {
  it('provides strict runtime codecs for every wire boundary', () => {
    for (const descriptor of TYPERT_REMOTE.descriptors) {
      expect(descriptor.result).toMatchObject({
        mode: 'strict',
        typeSymbol: expect.any(String),
        schema: { parse: expect.any(Function) },
      })
      for (const parameter of descriptor.parameters) {
        expect(parameter.codec).toMatchObject({
          mode: 'strict',
          typeSymbol: expect.any(String),
          schema: { parse: expect.any(Function) },
        })
      }
    }
  })
})
