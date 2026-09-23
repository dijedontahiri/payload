import type { Payload } from 'payload'

import path from 'path'
import { fileURLToPath } from 'url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { initPayloadInt } from '../__helpers/shared/initPayloadInt.js'
import { imageSizesOnlySlug } from './shared.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

let payload: Payload

describe('Local API filePath uploads with image sizes', () => {
  beforeAll(async () => {
    ;({ payload } = await initPayloadInt(dirname))
  })

  afterAll(async () => {
    await payload.destroy()
  })

  it('should create an upload from filePath when image sizes are configured', async () => {
    const doc = await payload.create({
      collection: imageSizesOnlySlug,
      data: {},
      filePath: path.resolve(dirname, 'image.jpg'),
    })

    try {
      expect(doc.filename).toBe('image.jpg')
      expect(doc.sizes?.sizeOne?.filename).toBeTruthy()
      expect(doc.sizes?.sizeTwo?.filename).toBeTruthy()
    } finally {
      await payload.delete({ collection: imageSizesOnlySlug, id: doc.id })
    }
  })
})
