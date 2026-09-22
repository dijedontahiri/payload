import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { categoriesSlug, postsSlug } from './shared.js'

test.suite({ config: './config.ts' })('MongoDB join multi-key sorting', () => {
  test.options({ db: 'mongo' })(
    'should apply every key in a multi-key join sort',
    async ({ payload }) => {
      const category = await payload.create({
        collection: categoriesSlug,
        data: {
          name: 'multi-sort category',
          group: {},
        },
      })

      for (const title of ['delta', 'alpha', 'charlie', 'bravo']) {
        await payload.create({
          collection: postsSlug,
          data: {
            category: category.id,
            title,
          },
        })
      }

      const result = await payload.findByID({
        id: category.id,
        collection: categoriesSlug,
        joins: {
          relatedPosts: {
            limit: 10,
            sort: ['category', 'title'] as unknown as string,
          },
        },
      })

      expect(result.relatedPosts.docs.map((post) => post.title)).toStrictEqual([
        'alpha',
        'bravo',
        'charlie',
        'delta',
      ])
    },
  )
})
