import type { Block } from 'payload'

import { describe, expect, it } from 'vitest'

import type { FormBuilderPluginConfig } from '../../types.js'

import { generateFormCollection } from './index.js'

const getBlocks = (config: FormBuilderPluginConfig): Block[] => {
  const collection = generateFormCollection(config)
  const blockField = collection.fields.find((field) => 'name' in field && field.name === 'fields')

  if (blockField?.type !== 'blocks') {
    throw new Error('Expected the generated form fields block field')
  }

  return blockField.blocks
}

describe('custom form field blocks', () => {
  it('uses the configuration key when a custom block does not specify a slug', () => {
    const customField = {
      fields: [{ name: 'value', type: 'text' as const }],
      labels: { plural: 'Hidden fields', singular: 'Hidden field' },
    }

    expect(getBlocks({ fields: { hidden: customField } })).toEqual([{ slug: 'hidden', ...customField }])
  })

  it('preserves an explicitly configured custom block slug', () => {
    const customField = {
      slug: 'custom-hidden',
      fields: [{ name: 'value', type: 'text' as const }],
    }

    expect(getBlocks({ fields: { hidden: customField } })).toEqual([customField])
  })

  it('gives separate custom block keys their own slugs', () => {
    const customField = { fields: [{ name: 'value', type: 'text' as const }] }
    const blocks = getBlocks({ fields: { first: customField, second: customField } })

    expect(blocks.map((block) => block.slug)).toEqual(['first', 'second'])
  })

  it('does not mutate a reusable custom block configuration', () => {
    const customField = Object.freeze({
      fields: [{ name: 'value', type: 'text' as const }],
    })

    const [block] = getBlocks({ fields: { hidden: customField } })

    expect(block).not.toBe(customField)
    expect(block?.slug).toBe('hidden')
    expect(customField).not.toHaveProperty('slug')
  })

  it('preserves built-in fields and filters disabled or unknown boolean fields', () => {
    const blocks = getBlocks({ fields: { hidden: false, text: true, unknown: true } })

    expect(blocks.map((block) => block.slug)).toEqual(['text'])
  })
})
