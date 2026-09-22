import type { Payload } from 'payload'

import path from 'path'
import { fileURLToPath } from 'url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { initPayloadInt } from '../__helpers/shared/initPayloadInt.js'
import { categoriesSlug, postsSlug } from './shared.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

let payload: Payload
let categoryID: number | string
const postIDs: Array<number | string> = []

describe('MongoDB join multi-key sorting', () => {
  beforeAll(async () => {
    ;({ payload } = await initPayloadInt(dirname))

    const category = await payload.create({
      collection: categoriesSlug,
      data: {
        name: 'multi-sort category',
        group: {},
      },
    })

    categoryID = category.id

    for (const title of ['delta', 'alpha', 'charlie', 'bravo']) {
      const post = await payload.create({
        collection: postsSlug,
        data: {
          category: categoryID,
          title,
        },
      })

      postIDs.push(post.id)
    }
  })

  afterAll(async () => {
    for (const id of postIDs) {
      await payload.delete({ id, collection: postsSlug })
    }

    await payload.delete({ id: categoryID, collection: categoriesSlug })
    await payload.destroy()
  })

  it('should apply every key in a multi-key join sort', async () => {
    const category = await payload.findByID({
      id: categoryID,
      collection: categoriesSlug,
      joins: {
        relatedPosts: {
          limit: 10,
          sort: ['category', 'title'] as unknown as string,
        },
      },
    })

    expect(category.relatedPosts.docs.map((post) => post.title)).toStrictEqual([
      'alpha',
      'bravo',
      'charlie',
      'delta',
    ])
  })
})
