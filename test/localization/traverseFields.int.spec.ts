import type { Payload } from 'payload'

import path from 'path'
import { traverseFields } from 'payload'
import { fileURLToPath } from 'url'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { initPayloadInt } from '../__helpers/shared/initPayloadInt.js'
import { groupSlug } from './collections/Group/index.js'
import { tabSlug } from './collections/Tab/index.js'
import { defaultLocale, spanishLocale } from './shared.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
let payload: Payload

const valuesFrom = (
  collection: typeof groupSlug | typeof tabSlug,
  ref: unknown,
  locale?: string,
) => {
  const values: Record<string, unknown[]> = {}

  traverseFields({
    callback: ({ field, parentPath, ref }) => {
      if (field.type === 'text') {
        const key = parentPath + field.name
        const value = (ref as Record<string, unknown>)[field.name]

        values[key] ??= []
        values[key].push(value)
      }
    },
    fields: payload.collections[collection].config.fields,
    fillEmpty: false,
    locale,
    ref,
  })

  return values
}

describe('traverseFields with persisted localized documents', () => {
  const records: { collection: typeof groupSlug | typeof tabSlug; id: number | string }[] = []

  beforeAll(async () => {
    ;({ payload } = await initPayloadInt(dirname))
  })

  afterEach(async () => {
    for (const record of records) {
      await payload.delete(record)
    }
    records.length = 0
  })

  afterAll(async () => {
    await payload.destroy()
  })

  it('should traverse group values returned by findByID and find without losing either locale', async () => {
    const doc = await payload.create({
      collection: groupSlug,
      data: {
        groupLocalized: { title: 'English group' },
        groupLocalizedRow: { text: 'English row' },
      },
      locale: defaultLocale,
    })

    records.push({ id: doc.id, collection: groupSlug })
    await payload.update({
      id: doc.id,
      collection: groupSlug,
      data: {
        groupLocalized: { title: 'Spanish group' },
        groupLocalizedRow: { text: 'Spanish row' },
      },
      locale: spanishLocale,
    })

    const english = await payload.findByID({
      id: doc.id,
      collection: groupSlug,
      fallbackLocale: false,
      locale: defaultLocale,
    })
    const spanish = await payload.find({
      collection: groupSlug,
      fallbackLocale: false,
      locale: spanishLocale,
      where: { id: { equals: doc.id } },
    })
    const all = await payload.findByID({
      id: doc.id,
      collection: groupSlug,
      fallbackLocale: false,
      locale: 'all',
    })

    expect(spanish.docs).toHaveLength(1)
    expect(valuesFrom(groupSlug, english, defaultLocale)).toMatchObject({
      'groupLocalized.title': ['English group'],
      'groupLocalizedRow.text': ['English row'],
    })
    expect(valuesFrom(groupSlug, spanish.docs[0], spanishLocale)).toMatchObject({
      'groupLocalized.title': ['Spanish group'],
      'groupLocalizedRow.text': ['Spanish row'],
    })
    expect(valuesFrom(groupSlug, all)['groupLocalized.title']).toEqual(
      expect.arrayContaining(['English group', 'Spanish group']),
    )
    expect(valuesFrom(groupSlug, all, 'all')).toEqual(valuesFrom(groupSlug, all))
  })

  it('should traverse persisted named-tab children, including nested groups and arrays', async () => {
    const doc = await payload.create({
      collection: tabSlug,
      data: {
        tabLocalized: {
          array: [{ title: 'English item' }],
          group: { heading: 'English heading' },
          title: 'English tab',
        },
      },
      locale: defaultLocale,
    })

    records.push({ id: doc.id, collection: tabSlug })
    await payload.update({
      id: doc.id,
      collection: tabSlug,
      data: {
        tabLocalized: {
          array: [{ title: 'Spanish item' }],
          group: { heading: 'Spanish heading' },
          title: 'Spanish tab',
        },
      },
      locale: spanishLocale,
    })

    const english = await payload.findByID({
      id: doc.id,
      collection: tabSlug,
      fallbackLocale: false,
      locale: defaultLocale,
    })
    const spanish = await payload.findByID({
      id: doc.id,
      collection: tabSlug,
      fallbackLocale: false,
      locale: spanishLocale,
    })
    const all = await payload.findByID({
      id: doc.id,
      collection: tabSlug,
      fallbackLocale: false,
      locale: 'all',
    })

    expect(valuesFrom(tabSlug, english, defaultLocale)).toMatchObject({
      'tabLocalized.array.title': ['English item'],
      'tabLocalized.group.heading': ['English heading'],
      'tabLocalized.title': ['English tab'],
    })
    expect(valuesFrom(tabSlug, spanish, spanishLocale)).toMatchObject({
      'tabLocalized.array.title': ['Spanish item'],
      'tabLocalized.group.heading': ['Spanish heading'],
      'tabLocalized.title': ['Spanish tab'],
    })
    expect(valuesFrom(tabSlug, all)['tabLocalized.title']).toEqual(
      expect.arrayContaining(['English tab', 'Spanish tab']),
    )
    expect(valuesFrom(tabSlug, all, 'all')).toEqual(valuesFrom(tabSlug, all))
  })
})
