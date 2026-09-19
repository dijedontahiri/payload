import { describe, expect, it } from 'vitest'

import { fieldSchemasToFormState } from './index.js'
import { renderField } from './renderField.js'

describe('Form - fieldSchemasToFormState', () => {
  const defaultValue = 'Default'
  it('populates default value - normal fields', async () => {
    const fieldSchema = [
      {
        name: 'text',
        type: 'text',
        defaultValue,
        label: 'Text',
      },
    ]
    const state = await fieldSchemasToFormState({ req: {}, fields: fieldSchema })
    expect(state.text.value).toBe(defaultValue)
  })
  it('field value overrides defaultValue - normal fields', async () => {
    const value = 'value'
    const data = { text: value }
    const fieldSchema = [
      {
        name: 'text',
        type: 'text',
        defaultValue,
        label: 'Text',
      },
    ]
    const state = await fieldSchemasToFormState({ req: {}, data, fields: fieldSchema })
    expect(state.text.value).toBe(value)
  })
  it('populates default value from a function - normal fields', async () => {
    const user = { email: 'user@example.com' }
    const locale = 'en'
    const fieldSchema = [
      {
        name: 'text',
        type: 'text',
        defaultValue: (args) => {
          if (!args.locale) {
            return 'missing locale'
          }
          if (!args.user) {
            return 'missing user'
          }
          return 'Default'
        },
        label: 'Text',
      },
    ]
    const state = await fieldSchemasToFormState({
      req: { locale: 'en', user: {} },
      fields: fieldSchema,
      locale,
      user,
    })
    expect(state.text.value).toBe(defaultValue)
  })

  it('renders a custom block component into row form state', () => {
    const block = {
      admin: {
        components: {
          Block: './CustomBlock.js',
        },
      },
      fields: [],
      labels: {
        plural: 'Custom blocks',
        singular: 'Custom block',
      },
      slug: 'custom',
    }
    const field = {
      blocks: [block],
      name: 'layout',
      type: 'blocks',
    }
    const fieldState = {
      rows: [
        {
          blockType: 'custom',
          id: 'row-1',
        },
      ],
    }

    renderField({
      clientFieldSchemaMap: new Map([['layout', field]]),
      fieldConfig: field,
      fieldState,
      mockRSCs: true,
      operation: 'update',
      path: 'layout',
      permissions: true,
      readOnly: false,
      renderAllFields: true,
      req: {
        payload: {
          blocks: {},
          importMap: {},
        },
      },
      schemaPath: 'layout',
    })

    expect(fieldState.rows[0].customComponents.Block).toBe('Mock')
  })
})
