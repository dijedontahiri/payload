import type { asc, desc, SQL, Table } from 'drizzle-orm'
import type { PgTableWithColumns } from 'drizzle-orm/pg-core'
import type { FlattenedField, Sort, Where } from 'payload'

import type { DrizzleAdapter, GenericColumn, GenericTable } from '../types.js'
import type { QueryContext } from './parseParams.js'

import { buildOrderBy } from './buildOrderBy.js'
import { parseParams } from './parseParams.js'

export type BuildQueryJoinAliases = {
  condition: SQL
  // with parent
  isOneToMany?: boolean
  queryPath?: string
  table: GenericTable | PgTableWithColumns<any>
  type?: 'innerJoin' | 'leftJoin' | 'rightJoin'
}[]

type BuildQueryArgs = {
  adapter: DrizzleAdapter
  aliasTable?: Table
  fields: FlattenedField[]
  joins?: BuildQueryJoinAliases
  locale?: string
  parentIsLocalized?: boolean
  selectLocale?: boolean
  sort?: Sort
  tableName: string
  where: Where
}

export type BuildQueryResult = {
  joins: BuildQueryJoinAliases
  orderBy: {
    column: GenericColumn
    order: typeof asc | typeof desc
  }[]
  selectFields: Record<string, GenericColumn>
  where: SQL
}

const normalizeBlockSchemaPath = ({
  adapter,
  fields,
  path,
}: {
  adapter: DrizzleAdapter
  fields: FlattenedField[]
  path: string
}): string => {
  const segments = path.split('.')
  const normalizedSegments: string[] = []
  let currentFields = fields

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    const field = currentFields.find((candidate) => candidate.name === segment)

    if (!field) {
      normalizedSegments.push(...segments.slice(index))
      break
    }

    normalizedSegments.push(segment)

    if (field.type === 'blocks' && index + 1 < segments.length) {
      const blockSlug = segments[index + 1]
      const block = (field.blockReferences ?? field.blocks)
        .map((candidate) =>
          typeof candidate === 'string' ? adapter.payload.blocks[candidate] : candidate,
        )
        .find((candidate) => candidate?.slug === blockSlug)

      if (block) {
        currentFields = block.flattenedFields
        index += 1
        continue
      }
    }

    if ('flattenedFields' in field) {
      currentFields = field.flattenedFields
    } else if (index + 1 < segments.length) {
      normalizedSegments.push(...segments.slice(index + 1))
      break
    }
  }

  return normalizedSegments.join('.')
}

const normalizeBlockSchemaPathsInWhere = ({
  adapter,
  fields,
  where,
}: {
  adapter: DrizzleAdapter
  fields: FlattenedField[]
  where: Where
}): Where => {
  const normalizedWhere: Where = {}

  for (const [key, value] of Object.entries(where)) {
    if ((key === 'and' || key === 'or') && Array.isArray(value)) {
      normalizedWhere[key] = value.map((clause) =>
        normalizeBlockSchemaPathsInWhere({ adapter, fields, where: clause }),
      )
      continue
    }

    normalizedWhere[normalizeBlockSchemaPath({ adapter, fields, path: key })] = value
  }

  return normalizedWhere
}

export const buildQuery = function buildQuery({
  adapter,
  aliasTable,
  fields,
  joins = [],
  locale,
  parentIsLocalized,
  selectLocale,
  sort,
  tableName,
  where: incomingWhere,
}: BuildQueryArgs): BuildQueryResult {
  const selectFields: Record<string, GenericColumn> = {
    id: adapter.tables[tableName].id,
  }

  let where: SQL

  const context: QueryContext = { sort }
  if (incomingWhere && Object.keys(incomingWhere).length > 0) {
    where = parseParams({
      adapter,
      aliasTable,
      context,
      fields,
      joins,
      locale,
      parentIsLocalized,
      selectFields,
      selectLocale,
      tableName,
      where: normalizeBlockSchemaPathsInWhere({ adapter, fields, where: incomingWhere }),
    })
  }

  const orderBy = buildOrderBy({
    adapter,
    aliasTable,
    fields,
    joins,
    locale,
    parentIsLocalized,
    rawSort: context.rawSort,
    selectFields,
    sort: context.sort,
    tableName,
  })

  return {
    joins,
    orderBy,
    selectFields,
    where,
  }
}
