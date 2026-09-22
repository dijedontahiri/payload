import type { Client } from '@libsql/client'

import { createClient } from '@libsql/client'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { withForeignKeysDisabled } from './migrate.js'

describe('withForeignKeysDisabled', () => {
  let client: Client
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'payload-sqlite-migrate-'))
    client = createClient({ url: `file:${join(directory, 'test.db')}` })
  })

  afterEach(async () => {
    client.close()
    await rm(directory, { force: true, recursive: true })
  })

  it('should disable foreign keys before a table-rebuild transaction and restore them afterwards', async () => {
    await client.execute('PRAGMA foreign_keys = ON')
    await client.executeMultiple(`
      CREATE TABLE parents (id INTEGER PRIMARY KEY);
      CREATE TABLE children (
        id INTEGER PRIMARY KEY,
        parent_id INTEGER NOT NULL REFERENCES parents(id) ON DELETE SET NULL
      );
      INSERT INTO parents (id) VALUES (1);
      INSERT INTO children (id, parent_id) VALUES (1, 1);
    `)

    await expect(dropParentTable(client)).rejects.toThrow()

    await withForeignKeysDisabled(client, () => dropParentTable(client))

    const { rows } = await client.execute('PRAGMA foreign_keys')

    expect(Number(rows[0]?.foreign_keys)).toBe(1)
  })

  it('should preserve an already-disabled foreign key setting', async () => {
    await client.execute('PRAGMA foreign_keys = OFF')

    await withForeignKeysDisabled(client, async () => {
      const { rows } = await client.execute('PRAGMA foreign_keys')

      expect(Number(rows[0]?.foreign_keys)).toBe(0)
    })

    const { rows } = await client.execute('PRAGMA foreign_keys')

    expect(Number(rows[0]?.foreign_keys)).toBe(0)
  })

  it('should restore foreign keys when a migration operation throws', async () => {
    await client.execute('PRAGMA foreign_keys = ON')

    await expect(
      withForeignKeysDisabled(client, async () => {
        throw new Error('migration failed')
      }),
    ).rejects.toThrow('migration failed')

    const { rows } = await client.execute('PRAGMA foreign_keys')

    expect(Number(rows[0]?.foreign_keys)).toBe(1)
  })
})

const dropParentTable = async (client: Client): Promise<void> => {
  const transaction = await client.transaction('write')

  try {
    await transaction.execute('DROP TABLE parents')
    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  } finally {
    transaction.close()
  }
}
