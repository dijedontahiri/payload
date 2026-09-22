import type { Client } from '@libsql/client'

import { migrate as drizzleMigrate } from '@payloadcms/drizzle'

import type { SQLiteAdapter } from './types.js'

export const withForeignKeysDisabled = async <T>(
  client: Client,
  operation: () => Promise<T>,
): Promise<T> => {
  const { rows } = await client.execute('PRAGMA foreign_keys')
  const shouldRestoreForeignKeys = Number(rows[0]?.foreign_keys ?? 0) === 1

  if (shouldRestoreForeignKeys) {
    await client.execute('PRAGMA foreign_keys = OFF')
  }

  try {
    return await operation()
  } finally {
    if (shouldRestoreForeignKeys) {
      await client.execute('PRAGMA foreign_keys = ON')
    }
  }
}

export const migrate: SQLiteAdapter['migrate'] = async function migrate(args) {
  return withForeignKeysDisabled(this.client, () => drizzleMigrate.call(this, args))
}
