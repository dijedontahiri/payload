import { describe, expect, it } from 'vitest'

import { optionsReducer } from './optionsReducer.js'

const collection = {
  admin: { useAsTitle: 'title' },
  fields: [{ name: 'title', type: 'text' }],
  labels: {
    plural: {
      en: 'Case Studies',
      zh: '客户案例',
    },
  },
  slug: 'case-studies',
} as any

const config = {
  admin: {
    dateFormat: 'yyyy-MM-dd',
  },
} as any

const i18n = {
  fallbackLanguage: 'en',
  language: 'en',
  t: (key: string) => key,
} as any

describe('relationship optionsReducer', () => {
  describe('localized collection labels', () => {
    it('should add subsequent batches to the translated option group', () => {
      const firstBatch = optionsReducer([], {
        collection,
        config,
        docs: [],
        i18n,
        ids: ['1'],
        type: 'ADD',
      })

      const result = optionsReducer(firstBatch, {
        collection,
        config,
        docs: [],
        i18n,
        ids: ['2'],
        type: 'ADD',
      })

      expect(result).toHaveLength(1)
      expect(result[0]?.label).toBe('Case Studies')
      expect(result[0]?.options.map((option) => option.value)).toEqual(['1', '2'])
    })

    it('should remove options from the translated option group', () => {
      const result = optionsReducer(
        [
          {
            label: 'Case Studies',
            options: [
              {
                allowEdit: true,
                label: 'Case Study',
                relationTo: 'case-studies',
                value: '1',
              },
            ],
          },
        ],
        {
          collection,
          config,
          i18n,
          id: '1',
          type: 'REMOVE',
        },
      )

      expect(result[0]?.options).toEqual([])
    })

    it('should update options in the translated option group', () => {
      const result = optionsReducer(
        [
          {
            label: 'Case Studies',
            options: [
              {
                allowEdit: true,
                label: 'Old title',
                relationTo: 'case-studies',
                value: '1',
              },
            ],
          },
        ],
        {
          collection,
          config,
          doc: { id: '1', title: 'New title' },
          i18n,
          type: 'UPDATE',
        },
      )

      expect(result[0]?.options[0]?.label).toBe('New title')
    })
  })
})
