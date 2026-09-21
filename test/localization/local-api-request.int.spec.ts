import type { Payload } from 'payload'

import path from 'path'
import { createLocalReq } from 'payload'
import { fileURLToPath } from 'url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { initPayloadInt } from '../__helpers/shared/initPayloadInt.js'
import { defaultLocale, localizedPostsSlug, spanishLocale } from './shared.js'

let payload: Payload

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

describe('Localized Local API requests', () => {
  beforeAll(async () => {
    ;({ payload } = await initPayloadInt(dirname))
  })

  afterAll(async () => {
    await payload.destroy()
  })

  it('should preserve parent request locale state when a nested Local API call overrides locale', async () => {
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