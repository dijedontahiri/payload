import type { Payload } from 'payload'

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'

import { describe } from '../__helpers/int/vitest.js'
import { initPayloadInt } from '../__helpers/shared/initPayloadInt.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

let payload: Payload

describe('join fields through blocks', { db: (adapter) => adapter.startsWith('postgres') }, () => {
  beforeAll(async () => {
    ;({ payload } = await initPayloadInt(dirname))
  })

  afterAll(async () => {
    await payload.destroy()
  })

  it('should populate a join whose on path crosses a blocks field', async () => {
    const relatedDocument = await payload.create({
      collection: 'documents',
      data: {
        title: 'Issue 18273 relation',
      },
      depth: 0,
    })

    const page = await payload.create({
      collection: 'pages',
      data: {
        layout: [
          {
            blockType: 'documentList',
            docs: [relatedDocument.id],
          },
        ],
        title: 'Issue 18273 page',
      },
      depth: 0,
    })

    let lookupError: unknown
    let populatedDocument: Awaited<ReturnType<typeof payload.findByID>> | undefined

    try {
      populatedDocument = await payload.findByID({
        id: relatedDocument.id,
        collection: 'documents',
        depth: 0,
      })
    } catch (error) {
      lookupError = error
    }

    expect(
      lookupError,
      'issue 18273 regression: join through a block should not crash collection reads',
    ).toBeUndefined()

    expect(
      populatedDocument?.listedOn?.docs?.map((doc) => (typeof doc === 'object' ? doc.id : doc)),
      'issue 18273 regression: join through a block should populate the matching page',
    ).toContain(page.id)
  })
})
