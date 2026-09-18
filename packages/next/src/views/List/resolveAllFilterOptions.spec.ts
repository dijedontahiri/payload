import type { Field, PayloadRequest } from 'payload'

import { describe, expect, it } from 'vitest'

import { resolveAllFilterOptions } from './resolveAllFilterOptions.js'

describe('resolveAllFilterOptions', () => {
  it('should key virtual relationship filter options by the virtual path', async () => {
    const fields: Field[] = [
      {
        name: 'region',
        type: 'relationship',
        relationTo: 'regions',
        virtual: 'customer.region',
        filterOptions: () => ({ id: { equals: 1 } }),
      },
    ]

    const result = await resolveAllFilterOptions({
      fields,
      req: { user: null } as PayloadRequest,
    })

    expect(result.get('customer.region')).toEqual({
      regions: { id: { equals: 1 } },
    })
    expect(result.has('region')).toBe(false)
  })

  it('should compose a virtual path with its parent field path', async () => {
    const fields: Field[] = [
      {
        name: 'filters',
        type: 'group',
        fields: [
          {
            name: 'region',
            type: 'relationship',
            relationTo: 'regions',
            virtual: 'customer.region',
            filterOptions: () => ({ id: { equals: 1 } }),
          },
        ],
      },
    ]

    const result = await resolveAllFilterOptions({
      fields,
      req: { user: null } as PayloadRequest,
    })

    expect(result.get('filters.customer.region')).toEqual({
      regions: { id: { equals: 1 } },
    })
    expect(result.has('filters.region')).toBe(false)
  })
})
