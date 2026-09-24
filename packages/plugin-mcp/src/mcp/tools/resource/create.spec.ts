import type { PayloadRequest } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { createResourceTool } from './create.js'

describe('createResourceTool', () => {
  it('should expose file input for upload collections', () => {
    let inputSchema: Record<string, unknown> | undefined
    const server = {
      registerTool: vi.fn((_name: string, options: { inputSchema: Record<string, unknown> }) => {
        inputSchema = options.inputSchema
      }),
    }
    const req = {
      payload: {
        collections: {
          media: {
            config: {
              upload: {},
            },
          },
        },
      },
    } as unknown as PayloadRequest

    createResourceTool(
      server as never,
      req,
      {} as never,
      false,
      'media',
      { media: { enabled: { create: true } } } as never,
      { properties: {}, type: 'object' },
    )

    expect(inputSchema?.file).toBeDefined()
  })
})
