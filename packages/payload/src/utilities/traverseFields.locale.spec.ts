import { describe, expect, it } from 'vitest'

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
            visited.push({
              parentIsLocalized,
              parentPath,
              ref,
              value: (ref as Record<string, unknown>)[field.name],
            })
          }
        },
        fields,
        fillEmpty: false,
        locale: 'en',
        ref: data,
      })

      expect(visited).toEqual([
        { parentIsLocalized: true, parentPath: 'legal.', ref: data.legal, value: 'English' },
      ])
      expect(data).toEqual({ legal: { en: 'English' } })
    })

    it.each([undefined, 'all'])(
      'should preserve raw locale maps when a field is named en (%s)',
      (locale) => {
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
      },
    )

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
      fields: [
        {
          name: 'legal',
          type: 'group',
          localized: true,
          fields: [
            {
              type: 'row',
              fields: [
                {
                  type: 'tabs',
                  tabs: [{ label: 'Notice', fields: [{ name: 'notice', type: 'text' }] }],
                },
              ],
            },
          ],
        },
      ],
      fillEmpty: false,
      locale: 'en',
      ref: data,
    })

    expect(values).toEqual(['Terms'])
  })

  it.each(['array', 'blocks'] as const)('should forward the locale through %s rows', (type) => {
    const group: Field = {
      name: 'legal',
      type: 'group',
      localized: true,
      fields: [{ name: 'notice', type: 'text' }],
    }
    const fields: Field[] =
      type === 'array'
        ? [{ name: 'rows', type: 'array', fields: [group] }]
        : [{ name: 'rows', type: 'blocks', blocks: [{ slug: 'notice', fields: [group] }] }]
    const data = { rows: [{ blockType: 'notice', legal: { notice: 'Terms' } }] }
    const values: unknown[] = []

    traverseFields({
      callback: ({ field, parentPath, ref }) => {
        if (field.type === 'text') {
          values.push({
            path: parentPath + field.name,
            value: (ref as Record<string, unknown>)[field.name],
          })
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
