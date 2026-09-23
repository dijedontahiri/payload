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
        {
          name: 'listedOn',
          type: 'join',
          collection: 'pages',
          on: 'layout.documentList.docs',
        },
      ],
    },
    {
      slug: 'pages',
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'layout',
          type: 'blocks',
          blocks: [
            {
              slug: 'documentList',
              fields: [
                {
                  name: 'docs',
                  type: 'relationship',
                  hasMany: true,
                  relationTo: 'documents',
                },
              ],
            },
            {
              slug: 'textBlock',
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
    },
  ],
})
