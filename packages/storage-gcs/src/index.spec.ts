import type { Config } from 'payload'

import { describe, expect, it } from 'vitest'

import { gcsStorage } from './index.js'

describe('gcsStorage', () => {
  it('should insert storage fields when disabled and alwaysInsertFields is true', () => {
    const config = {
      collections: [
        {
          slug: 'media',
          fields: [],
          upload: true,
        },
      ],
    } as Config

    const result = gcsStorage({
      alwaysInsertFields: true,
      bucket: 'test-bucket',
      collections: { media: true },
      enabled: false,
      options: {},
    })(config)

    const media = result.collections?.find(({ slug }) => slug === 'media')
    const fieldNames = media?.fields.flatMap((field) => ('name' in field ? [field.name] : []))

    expect(fieldNames).toContain('prefix')
    expect(fieldNames).toContain('_objectKey')
  })
})
