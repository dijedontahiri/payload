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

  it('preserves block metadata when publishing fallback-resolved form data to a locale', async () => {
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

    // Match the admin form after switching from the populated default locale to an empty
    // secondary locale: the form is showing the default locale through fallback resolution,
    // and FormSubmit sends those visible values back when "Publish in <locale>" is used.
    const fallbackDoc = await payload.findByID({
      id: page.id,
      collection: 'pages',
      fallbackLocale: 'en',
      locale: 'es',
      overrideAccess: true,
    })

    for (const tabName of ['tab1', 'tab2', 'tab3'] as const) {
      expect(fallbackDoc[tabName]?.layout?.[0]?.blockType).toBe('callToAction')
    }

    const firstPublish = await payload.update({
      id: page.id,
      collection: 'pages',
      data: {
        _status: 'published',
        tab1: fallbackDoc.tab1,
        tab2: fallbackDoc.tab2,
        tab3: fallbackDoc.tab3,
      },
      fallbackLocale: 'en',
      locale: 'es',
      overrideAccess: true,
      publishSpecificLocale: 'es',
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

    let secondPublish: Awaited<ReturnType<typeof payload.update>> | undefined
    let secondPublishError: unknown

    try {
      secondPublish = await payload.update({
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
        publishSpecificLocale: 'es',
      })
    } catch (error) {
      secondPublishError = error
    }

    expect(
      secondPublishError,
      'issue 18275 regression: repeated fallback-locale publish should not reject malformed block metadata',
    ).toBeUndefined()

    for (const tabName of ['tab1', 'tab2', 'tab3'] as const) {
      const block = secondPublish?.[tabName]?.layout?.[0]
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
