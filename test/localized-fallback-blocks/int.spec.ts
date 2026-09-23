import type { Payload } from 'payload'

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'

import { describe } from '../__helpers/int/vitest.js'
import { initPayloadInt } from '../__helpers/shared/initPayloadInt.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

let payload: Payload

describe('localized blocks fallback publishing', { db: (adapter) => adapter.startsWith('postgres') }, () => {
  beforeAll(async () => {
    ;({ payload } = await initPayloadInt(dirname))
  })

  afterAll(async () => {
    await payload.destroy()
  })

  it('preserves block metadata when publishing a locale that is using fallback blocks', async () => {
    const makeTab = (suffix: string) => ({
      layout: [
        {
          blockName: `CTA ${suffix}`,
          blockType: 'callToAction',
          text: `English ${suffix}`,
        },
      ],
    })

    const page = await payload.create({
      collection: 'pages',
      data: {
        _status: 'published',
        tab1: makeTab('one'),
        tab2: makeTab('two'),
        tab3: makeTab('three'),
        title: 'Issue 18275',
      },
      locale: 'en',
      overrideAccess: true,
    })

    const firstPublish = await payload.update({
      id: page.id,
      collection: 'pages',
      data: {
        _status: 'published',
      },
      fallbackLocale: 'en',
      locale: 'es',
      overrideAccess: true,
    })

    for (const tabName of ['tab1', 'tab2', 'tab3'] as const) {
      const block = firstPublish[tabName]?.layout?.[0]
      expect(
        block?.blockType,
        `issue 18275 regression: ${tabName} fallback block should retain blockType after first publish`,
      ).toBe('callToAction')
      expect(
        block?.blockName,
        `issue 18275 regression: ${tabName} fallback block should retain blockName after first publish`,
      ).toBe(`CTA ${tabName === 'tab1' ? 'one' : tabName === 'tab2' ? 'two' : 'three'}`)
    }

    const secondPublish = await payload.update({
      id: page.id,
      collection: 'pages',
      data: {
        _status: 'published',
        tab1: firstPublish.tab1,
        tab2: firstPublish.tab2,
        tab3: firstPublish.tab3,
      },
      fallbackLocale: 'en',
      locale: 'es',
      overrideAccess: true,
    })

    for (const tabName of ['tab1', 'tab2', 'tab3'] as const) {
      const block = secondPublish[tabName]?.layout?.[0]
      expect(
        block?.blockType,
        `issue 18275 regression: ${tabName} fallback block should retain blockType after repeated publish`,
      ).toBe('callToAction')
      expect(
        block?.blockName,
        `issue 18275 regression: ${tabName} fallback block should retain blockName after repeated publish`,
      ).toBe(`CTA ${tabName === 'tab1' ? 'one' : tabName === 'tab2' ? 'two' : 'three'}`)
    }
  })
})
