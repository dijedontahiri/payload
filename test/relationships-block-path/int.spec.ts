import type { Payload } from 'payload'

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect } from 'vitest'

import { describe, it } from '../__helpers/int/vitest.js'
import { initPayloadInt } from '../__helpers/shared/initPayloadInt.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

let payload: Payload

describe('block relationship query paths', { db: (adapter) => adapter.startsWith('postgres') }, () => {
  beforeAll(async () => {
    ;({ payload } = await initPayloadInt(dirname))
  })

  afterAll(async () => {
    await payload.destroy()
  })

  it('should query a hasMany relationship in a non-first block definition', async () => {
    const relatedDocument = await payload.create({
      collection: 'documents',
      data: {
        title: 'Issue 18272 relation',
      },
    })

    const page = await payload.create({
      collection: 'pages',
      data: {
        layout: [
          {
            blockType: 'documentList',
            documents: [relatedDocument.id],
          },
        ],
      },
    })

    const result = await payload.find({
      collection: 'pages',
      where: {
        'layout.documents': {
          equals: relatedDocument.id,
        },
      },
    })

    expect(result.docs.map((doc) => doc.id)).toContain(page.id)
  })
})
