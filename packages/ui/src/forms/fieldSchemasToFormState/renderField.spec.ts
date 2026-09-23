import { describe, expect, it } from 'vitest'

import { renderField } from './renderField.js'

type RenderFieldArgs = Parameters<typeof renderField>[0]

describe('renderField', () => {
  it('should render a custom block component into row form state', () => {
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
    } as RenderFieldArgs['fieldConfig']
    const fieldState: RenderFieldArgs['fieldState'] = {
      rows: [
        {
          blockType: 'custom',
          id: 'row-1',
        },
      ],
    }

    renderField({
      clientFieldSchemaMap: new Map([['layout', field]]),
      collectionSlug: 'pages',
      data: {},
      fieldConfig: field,
      fieldSchemaMap: new Map(),
      fieldState,
      formState: {},
      indexPath: '',
      lastRenderedPath: '',
      mockRSCs: true,
      operation: 'update',
      parentPath: '',
      parentSchemaPath: '',
      path: 'layout',
      permissions: true,
      preferences: {},
      previousFieldState: {},
      readOnly: false,
      renderAllFields: true,
      req: {
        payload: {
          blocks: {},
          importMap: {},
        },
      } as RenderFieldArgs['req'],
      schemaPath: 'layout',
      siblingData: {},
    })

    expect(fieldState.rows?.[0]?.customComponents?.Block).toBe('Mock')
  })
})
