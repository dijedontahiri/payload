import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'

export default buildConfigWithDefaults({
  collections: [
    {
      slug: 'documents',
      fields: [
        {
          name: 'title',
          type: 'text',
        },
      ],
    },
    {
      slug: 'pages',
      fields: [
        {
          name: 'layout',
          type: 'blocks',
          blocks: [
            {
              slug: 'textBlock',
              fields: [
                {
                  name: 'text',
                  type: 'text',
                },
              ],
            },
            {
              slug: 'documentList',
              fields: [
                {
                  name: 'documents',
                  type: 'relationship',
                  hasMany: true,
                  relationTo: 'documents',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
})
