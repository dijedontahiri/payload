import { createLocalReq } from 'payload'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { defaultLocale, localizedPostsSlug, spanishLocale } from './shared.js'

test.suite({ config: './config.ts' })('Localized Local API requests', () => {
  test('should preserve parent request locale state when a nested Local API call overrides locale', async ({
    payload,
  }) => {
    const req = await createLocalReq({ locale: spanishLocale }, payload)

    expect(req.locale).toBe(spanishLocale)
    expect(req.fallbackLocale).toBe(defaultLocale)

    await payload.find({
      collection: localizedPostsSlug,
      depth: 0,
      fallbackLocale: false,
      limit: 1,
      locale: defaultLocale,
      req,
    })

    expect(req.locale).toBe(spanishLocale)
    expect(req.fallbackLocale).toBe(defaultLocale)
  })
})
