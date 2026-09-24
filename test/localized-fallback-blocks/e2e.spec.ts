import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { changeLocale, ensureCompilationIsDone, waitForFormReady } from '../__helpers/e2e/helpers.js'
import { AdminUrlUtil } from '../__helpers/shared/adminUrlUtil.js'
import { initPayloadE2ENoConfig } from '../__helpers/shared/initPayloadE2ENoConfig.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

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
  })

  test.afterAll(async () => {
    await page?.close()
  })

  test('preserves block metadata when the Admin UI publishes fallback blocks into another locale', async () => {
    const makeTab = (suffix: string) => ({
      layout: [
        {
          blockName: `CTA ${suffix}`,
          blockType: 'callToAction',
          text: `English ${suffix}`,
        },
      ],
    })

    const doc = await payload.create({
      collection: 'pages',
      data: {
        _status: 'published',
        tab1: makeTab('one'),
        tab2: makeTab('two'),
        tab3: makeTab('three'),
        title: 'Issue 18275 browser reproduction',
      },
      locale: 'en',
      overrideAccess: true,
    })

    await page.goto(url.edit(doc.id))
    await waitForFormReady(page)
    await changeLocale(page, 'es')
    await waitForFormReady(page)

    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes(`/api/pages/${doc.id}`) &&
        response.url().includes('publishSpecificLocale=es'),
    )

    await page.locator('.form-submit:has(#action-save) .popup-button').click()
    await page.locator('#publish-locale').click()

    const response = await responsePromise
    expect(response.status()).toBeLessThan(400)

    const json = await response.json()
    const published = json.doc

    for (const [tabName, suffix] of [
      ['tab1', 'one'],
      ['tab2', 'two'],
      ['tab3', 'three'],
    ] as const) {
      const block = published?.[tabName]?.layout?.[0]
      expect(
        block?.blockType,
        `issue 18275 regression: ${tabName} should retain blockType after Admin UI locale publish`,
      ).toBe('callToAction')
      expect(
        block?.blockName,
        `issue 18275 regression: ${tabName} should retain blockName after Admin UI locale publish`,
      ).toBe(`CTA ${suffix}`)
    }
  })
})
