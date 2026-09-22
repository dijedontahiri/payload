import { describe, expect, it } from 'vitest'

import type { DrizzleAdapter } from '../types.js'

import { sanitizeQueryValue } from './sanitizeQueryValue.js'

describe('sanitizeQueryValue', () => {
  it('deduplicates relationship ids after coercing them to the collection id type', () => {
    const ids = Array.from({ length: 50 }, (_, index) => index + 1)
    const adapter = {
      idType: 'number',
      payload: {
        collections: {
          posts: {},
        },
      },
    } as unknown as DrizzleAdapter

    const result = sanitizeQueryValue({
      adapter,
      field: {
        name: 'parent',
        relationTo: 'posts',
        type: 'relationship',
      },
      isUUID: false,
      operator: 'in',
      relationOrPath: 'parent',
      val: ids,
    })

    expect(result.value).toEqual(ids)
  })
})
