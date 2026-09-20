from pathlib import Path
import re
import subprocess

BASE = 'd58f8fba427dda48101ba274ef6f3889690fb244'
SOURCE = 'packages/payload/src/utilities/traverseFields.ts'
OLD_TEST = 'packages/payload/src/utilities/traverseFields.spec.ts'

def original(path):
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'], text=True)

def replace_once(text, old, new):
    assert text.count(old) == 1, (old, text.count(old))
    return text.replace(old, new, 1)

source = original(SOURCE)
# Thread the explicit input representation through every recursive path.
source = re.sub(r'(?m)^(\s*)leavesFirst,$', r'\1leavesFirst,\n\1locale,', source)
source = replace_once(source, '  leavesFirst: boolean\n', '  leavesFirst: boolean\n  locale: string\n')
source = replace_once(source, '  leavesFirst?: boolean\n', '''  leavesFirst?: boolean
  /**
   * The locale used to read `ref`. Pass a specific locale for resolved data, or
   * `all` for data whose localized fields contain locale-to-value maps.
   * Omit this option when traversing database-shaped data or only the schema.
   * This describes the input shape; it does not resolve or filter locales.
   *
   * @default 'all'
   */
  locale?: string
''')
source = replace_once(source, '  leavesFirst = false,\n', "  leavesFirst = false,\n  locale = 'all',\n")
assert source.count('if (tabIsLocalized) {') == 2
source = source.replace('if (tabIsLocalized) {', "if (tabIsLocalized && locale === 'all') {")
source = replace_once(source, 'if (!tabIsLocalized) {', "if (!tabIsLocalized || locale !== 'all') {")
start = source.index("if (!tabIsLocalized || locale !== 'all') {")
end = source.index('\n        if (skip)', start)
section = source[start:end]
section = replace_once(section, '            parentIsLocalized,', '            parentIsLocalized: parentIsLocalized || tabIsLocalized,')
source = source[:start] + section + source[end:]
initialization = 'if (fieldShouldBeLocalized({ field, parentIsLocalized })) {'
assert source.count(initialization) == 3
source = source.replace(initialization, "if (fieldShouldBeLocalized({ field, parentIsLocalized }) && locale === 'all') {", 2)
source = replace_once(source, "        (field.type === 'tab' || field.type === 'group') &&\n", "        locale === 'all' &&\n        (field.type === 'tab' || field.type === 'group') &&\n")
start = source.index("} else if (currentRef && typeof currentRef === 'object' && 'fields' in field) {")
end = source.index('\n    if (isTopLevel)', start)
section = source[start:end]
section = replace_once(section, '          parentIsLocalized,', '          parentIsLocalized: parentIsLocalized || fieldShouldBeLocalized({ field, parentIsLocalized }),')
source = source[:start] + section + source[end:]
assert 'refContainsFieldData' not in source
Path(SOURCE).write_text(source)
# Replace the earlier heuristic's two weak tests with a separate value-based suite.
Path(OLD_TEST).write_text(original(OLD_TEST))

Path('packages/payload/src/utilities/traverseFields.locale.spec.ts').write_text('''import { describe, expect, it } from 'vitest'

import type { Field, TabAsField } from '../fields/config/types.js'

import { traverseFields } from './traverseFields.js'

const childFields: Field[] = [{ name: 'en', type: 'text' }]
const containers: { fields: (Field | TabAsField)[]; name: string }[] = [
  {
    name: 'group',
    fields: [{ name: 'legal', type: 'group', localized: true, fields: childFields }],
  },
  {
    name: 'named tab',
    fields: [{ type: 'tabs', tabs: [{ name: 'legal', localized: true, fields: childFields }] }],
  },
  {
    name: 'tab field',
    fields: [{ name: 'legal', type: 'tab', localized: true, fields: childFields }],
  },
]

describe('traverseFields locale input', () => {
  describe.each(containers)('$name', ({ fields }) => {
    it('should visit resolved values with their reference, path and localization context', () => {
      const data = { legal: { en: 'English' } }
      const visited: unknown[] = []

      traverseFields({
        callback: ({ field, parentIsLocalized, parentPath, ref }) => {
          if (field.type === 'text') {
            visited.push({ parentIsLocalized, parentPath, ref, value: (ref as Record<string, unknown>)[field.name] })
          }
        },
        fields,
        fillEmpty: false,
        locale: 'en',
        ref: data,
      })

      expect(visited).toEqual([{ parentIsLocalized: true, parentPath: 'legal.', ref: data.legal, value: 'English' }])
      expect(data).toEqual({ legal: { en: 'English' } })
    })

    it.each([undefined, 'all'])('should preserve raw locale maps when a field is named en (%s)', (locale) => {
      const data = { legal: { en: { en: 'English' }, es: { en: 'Spanish' } } }
      const values: unknown[] = []

      traverseFields({
        callback: ({ field, ref }) => {
          if (field.type === 'text') {
            values.push((ref as Record<string, unknown>)[field.name])
          }
        },
        fields,
        fillEmpty: false,
        locale,
        ref: data,
      })

      expect(values).toEqual(['English', 'Spanish'])
      expect(data).toEqual({ legal: { en: { en: 'English' }, es: { en: 'Spanish' } } })
    })

    it('should fill missing resolved containers without introducing a locale map', () => {
      const data = {}
      const values: unknown[] = []

      traverseFields({
        callback: ({ field, ref }) => {
          if (field.type === 'text') {
            values.push((ref as Record<string, unknown>)[field.name])
          }
        },
        fields,
        locale: 'en',
        ref: data,
      })

      expect(data).toEqual({ legal: {} })
      expect(values).toEqual([undefined])
    })

    it('should retain the existing schema-only locale map by default', () => {
      const data = {}

      traverseFields({ callback: () => {}, fields, ref: data })

      expect(data).toEqual({ legal: { en: {} } })
    })
  })

  it('should traverse resolved values through unnamed layout fields', () => {
    const values: unknown[] = []
    const data = { legal: { notice: 'Terms' } }

    traverseFields({
      callback: ({ field, ref }) => {
        if (field.type === 'text') {
          values.push((ref as Record<string, unknown>)[field.name])
        }
      },
      fields: [{
        name: 'legal', type: 'group', localized: true,
        fields: [{ type: 'row', fields: [{ type: 'tabs', tabs: [{ label: 'Notice', fields: [{ name: 'notice', type: 'text' }] }] }] }],
      }],
      fillEmpty: false,
      locale: 'en',
      ref: data,
    })

    expect(values).toEqual(['Terms'])
  })

  it.each(['array', 'blocks'] as const)('should forward the locale through %s rows', (type) => {
    const group: Field = { name: 'legal', type: 'group', localized: true, fields: [{ name: 'notice', type: 'text' }] }
    const fields: Field[] = type === 'array'
      ? [{ name: 'rows', type: 'array', fields: [group] }]
      : [{ name: 'rows', type: 'blocks', blocks: [{ slug: 'notice', fields: [group] }] }]
    const data = { rows: [{ blockType: 'notice', legal: { notice: 'Terms' } }] }
    const values: unknown[] = []

    traverseFields({
      callback: ({ field, parentPath, ref }) => {
        if (field.type === 'text') {
          values.push({ path: parentPath + field.name, value: (ref as Record<string, unknown>)[field.name] })
        }
      },
      fields,
      fillEmpty: false,
      locale: 'en',
      ref: data,
    })

    expect(values).toEqual([{ path: 'rows.legal.notice', value: 'Terms' }])
  })
})
''')

exports = Path('packages/payload/src/index.ts').read_text()
assert "export { traverseFields } from './utilities/traverseFields.js'" in exports
Path('test/localization/traverseFields.int.spec.ts').write_text('''import type { Payload } from 'payload'

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

const valuesFrom = (collection: typeof groupSlug | typeof tabSlug, ref: unknown, locale?: string) => {
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
      data: { groupLocalized: { title: 'English group' }, groupLocalizedRow: { text: 'English row' } },
      locale: defaultLocale,
    })

    records.push({ collection: groupSlug, id: doc.id })
    await payload.update({
      collection: groupSlug,
      id: doc.id,
      data: { groupLocalized: { title: 'Spanish group' }, groupLocalizedRow: { text: 'Spanish row' } },
      locale: spanishLocale,
    })

    const english = await payload.findByID({ collection: groupSlug, id: doc.id, locale: defaultLocale, fallbackLocale: false })
    const spanish = await payload.find({ collection: groupSlug, where: { id: { equals: doc.id } }, locale: spanishLocale, fallbackLocale: false })
    const all = await payload.findByID({ collection: groupSlug, id: doc.id, locale: 'all', fallbackLocale: false })

    expect(spanish.docs).toHaveLength(1)
    expect(valuesFrom(groupSlug, english, defaultLocale)).toMatchObject({ 'groupLocalized.title': ['English group'], 'groupLocalizedRow.text': ['English row'] })
    expect(valuesFrom(groupSlug, spanish.docs[0], spanishLocale)).toMatchObject({ 'groupLocalized.title': ['Spanish group'], 'groupLocalizedRow.text': ['Spanish row'] })
    expect(valuesFrom(groupSlug, all)['groupLocalized.title']).toEqual(expect.arrayContaining(['English group', 'Spanish group']))
    expect(valuesFrom(groupSlug, all, 'all')).toEqual(valuesFrom(groupSlug, all))
  })

  it('should traverse persisted named-tab children, including nested groups and arrays', async () => {
    const doc = await payload.create({
      collection: tabSlug,
      data: { tabLocalized: { title: 'English tab', group: { heading: 'English heading' }, array: [{ title: 'English item' }] } },
      locale: defaultLocale,
    })

    records.push({ collection: tabSlug, id: doc.id })
    await payload.update({
      collection: tabSlug,
      id: doc.id,
      data: { tabLocalized: { title: 'Spanish tab', group: { heading: 'Spanish heading' }, array: [{ title: 'Spanish item' }] } },
      locale: spanishLocale,
    })

    const english = await payload.findByID({ collection: tabSlug, id: doc.id, locale: defaultLocale, fallbackLocale: false })
    const spanish = await payload.findByID({ collection: tabSlug, id: doc.id, locale: spanishLocale, fallbackLocale: false })
    const all = await payload.findByID({ collection: tabSlug, id: doc.id, locale: 'all', fallbackLocale: false })

    expect(valuesFrom(tabSlug, english, defaultLocale)).toMatchObject({ 'tabLocalized.title': ['English tab'], 'tabLocalized.group.heading': ['English heading'], 'tabLocalized.array.title': ['English item'] })
    expect(valuesFrom(tabSlug, spanish, spanishLocale)).toMatchObject({ 'tabLocalized.title': ['Spanish tab'], 'tabLocalized.group.heading': ['Spanish heading'], 'tabLocalized.array.title': ['Spanish item'] })
    expect(valuesFrom(tabSlug, all)['tabLocalized.title']).toEqual(expect.arrayContaining(['English tab', 'Spanish tab']))
    expect(valuesFrom(tabSlug, all, 'all')).toEqual(valuesFrom(tabSlug, all))
  })
})
''')
print('Prepared explicit-locale implementation, collision controls, and persisted-document integration tests.')
