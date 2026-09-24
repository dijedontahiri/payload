import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { changeLocale, ensureCompilationIsDone, waitForFormReady } from '../__helpers/e2e/helpers.js'
import { AdminUrlUtil } from '../__helpers/shared/adminUrlUtil.js'
import { initPayloadE2ENoConfig } from '../__helpers/shared/initPayloadE2ENoConfig.js'
import { devUser } from '../credentials.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const documentTitle = 'Issue 18275 browser reproduction'

let docID: number | string
let page: Page
let payload: any
let serverURL: string
let url: AdminUrlUtil

test.describe('issue 18275 localized fallback blocks', () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    ;({ payload, serverURL } = await initPayloadE2ENoConfig<any>({ dirname }))
    url = new AdminUrlUtil(serverURL, 'pages')
    page = await browser.newPage()
    await ensureCompilationIsDone({ page, serverURL })

    await payload.create({
      collection: 'users',
      data: devUser,
      overrideAccess: true,
    })

    const makeTab = (suffix: string) => ({
      layout: [
        {
          blockName: `CTA ${suffix}`,
          blockType: 'callToAction',
          text: `English ${suffix}`,
        },
      ],
    })

    // Match the reporter's new-page lifecycle and the precondition behind the earlier
    // block-metadata bug class: an autosaved draft exists before blocks are added, so the
    // published/main document does not already contain block metadata.
    const doc = await payload.create({
      collection: 'pages',
      data: {
        _status: 'draft',
        title: documentTitle,
      },
      draft: true,
      locale: 'en',
      overrideAccess: true,
    })
    docID = doc.id

    await payload.update({
      id: docID,
      collection: 'pages',
      data: {
        _status: 'draft',
        tab1: makeTab('one'),
        tab2: makeTab('two'),
        tab3: makeTab('three'),
      },
      draft: true,
      locale: 'en',
      overrideAccess: true,
    })
  })

  test.afterAll(async () => {
    await payload.delete({
      collection: 'pages',
      overrideAccess: true,
      where: {
        title: {
          equals: documentTitle,
        },
      },
    })
    await payload.delete({
      collection: 'users',
      overrideAccess: true,
      where: {
        email: {
          equals: devUser.email,
        },
      },
    })
    await page?.close()
  })

  test('should preserve block metadata when fallback blocks are published twice into another locale', async ({}, testInfo) => {
    testInfo.setTimeout(120_000)

    await page.goto(url.edit(docID))
    await waitForFormReady(page)
    await changeLocale(page, 'es')
    await waitForFormReady(page)

    const publishSelectedLocale = async () => {
      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          response.url().includes(`/api/pages/${docID}`) &&
          response.url().includes('publishSpecificLocale=es'),
      )

      await page.locator('.form-submit:has(#action-save) .popup-button').click()
      await page.locator('#publish-locale').click()

      return responsePromise
    }

    const firstResponse = await publishSelectedLocale()
    expect(
      firstResponse.status(),
      'issue 18275 regression: first Admin UI locale publish should succeed',
    ).toBeLessThan(400)
    await waitForFormReady(page)

    // The reporter observes fallback blocks being injected into form state after the first
    // locale-specific publish. That makes the form publishable again without another manual edit.
    // If this precondition is absent, the setup still does not reproduce the reported lifecycle.
    await expect(
      page.locator('.form-submit:has(#action-save) .popup-button'),
      'issue 18275 setup: repeated locale publish should become enabled after fallback form state is applied',
    ).toBeEnabled({ timeout: 10_000 })

    const secondResponse = await publishSelectedLocale()
    expect(
      secondResponse.status(),
      'issue 18275 regression: second Admin UI locale publish should succeed',
    ).toBeLessThan(400)

    const json = await secondResponse.json()
    const published = json.doc

    for (const [tabName, suffix] of [
      ['tab1', 'one'],
      ['tab2', 'two'],
      ['tab3', 'three'],
    ] as const) {
      const block = published?.[tabName]?.layout?.[0]
      expect(
        block?.blockType,
        `issue 18275 regression: ${tabName} should retain blockType after repeated Admin UI locale publish`,
      ).toBe('callToAction')
      expect(
        block?.blockName,
        `issue 18275 regression: ${tabName} should retain blockName after repeated Admin UI locale publish`,
      ).toBe(`CTA ${suffix}`)
    }
  })
})
