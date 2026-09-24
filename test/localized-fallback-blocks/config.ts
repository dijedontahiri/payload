import { postgresAdapter } from '@payloadcms/db-postgres'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const postgresURL = process.env.POSTGRES_URL || 'postgres://payload:payload@127.0.0.1:5433/payload'

export default buildConfigWithDefaults({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: 'users',
  },
  db: postgresAdapter({
    blocksAsJSON: true,
    pool: {
      connectionString: postgresURL,
    },
  }),
  experimental: {
    localizeStatus: true,
  },
  localization: {
    defaultLocale: 'en',
    fallback: true,
    locales: ['en', 'es', 'de'],
  },
  collections: [
    {
      slug: 'users',
      auth: true,
      fields: [],
    },
    {
      slug: 'pages',
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          type: 'tabs',
          tabs: [
            {
              fields: [
                {
                  type: 'tabs',
                  tabs: ['tab1', 'tab2', 'tab3'].map((name) => ({
                    name,
                    fields: [
                      {
                        name: 'layout',
                        type: 'blocks',
                        localized: true,
                        blocks: [
                          {
                            slug: 'callToAction',
                            fields: [
                              {
                                name: 'text',
                                type: 'text',
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  })),
                },
              ],
              label: 'Content',
            },
          ],
        },
      ],
      versions: {
        drafts: {
          autosave: true,
          localizeStatus: true,
        },
      },
    },
  ],
})
