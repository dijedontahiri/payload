import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { addBlock } from '../__helpers/e2e/fields/blocks/index.js'
import {
  changeLocale,
  ensureCompilationIsDone,
  switchTab,
  waitForFormReady,
} from '../__helpers/e2e/helpers.js'
import { waitForAutoSaveToRunAndComplete } from '../__helpers/e2e/waitForAutoSaveToRunAndComplete.js'
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

const selectTab = async (label: string) => {
  await switchTab(page, `button.tabs-field__tab-button:has-text("${label}")`)
}

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

    // Follow the reporter's Admin lifecycle exactly: creating a new page starts autosave before
    // the localized blocks are added. This matters because API-seeded drafts do not reproduce it.
    await page.goto(url.create)
    await waitForFormReady(page)
    await page.locator('#field-title').fill(documentTitle)
    await waitForAutoSaveToRunAndComplete(page)

    const docIDFromAdmin = await page.locator('.render-title').getAttribute('data-doc-id')
    expect(docIDFromAdmin, 'issue 18275 setup: autosave should create the draft document').toBeTruthy()
    docID = docIDFromAdmin as string

    // Autosave turns the create view into a persisted document. Navigate to the stable edit URL
    // before interacting with tabs so redirects from the create lifecycle cannot strand the test
    // on the dashboard while still preserving the real Admin/autosave document creation path.
    await page.goto(url.edit(docID))
    await waitForFormReady(page)

    await selectTab('Content')

    for (const [tabName, tabLabel, suffix] of [
      ['tab1', 'Tab 1', 'one'],
      ['tab2', 'Tab 2', 'two'],
      ['tab3', 'Tab 3', 'three'],
    ] as const) {
      await selectTab(tabLabel)
      await addBlock({
        blockToSelect: 'Call To Action',
        fieldName: `${tabName}__layout`,
        page,
      })

      // The reporter's blocks field uses initCollapsed: true. For a nested named tab the generic
      // toggle helper's row-id convention does not match the rendered row, so scope the toggle to
      // the exact row locator addBlock has already verified exists.
      const row = page
        .locator(`#field-${tabName}__layout > .blocks-field__rows > div > .blocks-field__row`)
        .last()
      const toggler = row.locator('button.collapsible__toggle')
      await expect(toggler).toHaveClass(/collapsible__toggle--collapsed/)
      await toggler.click()
      await expect(toggler).toHaveClass(/collapsible__toggle--open/)

      await page.locator(`#field-${tabName}__layout__0__text`).fill(`English ${suffix}`)
    }

    await waitForAutoSaveToRunAndComplete(page)
    await changeLocale(page, 'es')
    await waitForFormReady(page)

    // The reported reproduction keeps the required non-localized title while changing locales.
    // Current Admin form state can leave an unchanged non-localized input out of the locale-specific
    // submit payload, causing validation to fail before the fallback-block path is reached. Verify
    // the value is present, then re-emit its input event without changing the reporter's data so this
    // control isolates the blocks corruption rather than an unrelated required-field precondition.
    const titleInput = page.locator('#field-title')
    await expect(
      titleInput,
      'issue 18275 setup: non-localized title should remain visible after changing locale',
    ).toHaveValue(documentTitle)
    await titleInput.fill(documentTitle)

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

    // The reported corruption requires fallback blocks to be injected into the alternative-locale
    // form after the first publish. If that does not occur, the second publish cannot reproduce the
    // malformed block metadata path and this is still only a setup failure.
    await selectTab('Content')
    for (const [tabName, tabLabel] of [
      ['tab1', 'Tab 1'],
      ['tab2', 'Tab 2'],
      ['tab3', 'Tab 3'],
    ] as const) {
      await selectTab(tabLabel)
      await expect(
        page.locator(`#field-${tabName}__layout > .blocks-field__rows > div > .blocks-field__row`),
        `issue 18275 setup: fallback block should appear in ${tabName} after first locale publish`,
      ).toHaveCount(1, { timeout: 10_000 })
    }

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

    for (const tabName of ['tab1', 'tab2', 'tab3'] as const) {
      const block = published?.[tabName]?.layout?.[0]
      expect(
        block?.blockType,
        `issue 18275 regression: ${tabName} should retain blockType after repeated Admin UI locale publish`,
      ).toBe('callToAction')
      expect(
        block?.id,
        `issue 18275 regression: ${tabName} should retain id after repeated Admin UI locale publish`,
      ).toBeTruthy()
    }
  })
})
