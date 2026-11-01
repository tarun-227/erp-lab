import { describe, expect, it } from 'vitest'
import { BASE_PARAMS } from './presets'
import { decodeParams, encodeParams } from './share'
import type { ProcessParams } from './types'

describe('share links', () => {
  it('round-trips parameters, including non-ASCII names', () => {
    const p: ProcessParams = { ...BASE_PARAMS, conditions: [{ code: 1, name: 'standard' }, { code: 2, name: 'cible – rare µ' }] }
    expect(decodeParams(encodeParams(p))).toEqual(p)
  })

  it('rejects garbage', () => {
    expect(decodeParams('not-base64!!')).toBeNull()
    expect(decodeParams(btoa('{"conditions": 3}'))).toBeNull()
  })
})
