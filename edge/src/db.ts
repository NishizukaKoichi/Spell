import { connect, type Connection } from '@planetscale/database'

type DatabaseEnv = {
  DATABASE_URL?: string
}

let cachedConnection: { url: string; connection: Connection } | null = null

export function getDatabase(env: DatabaseEnv): Connection {
  const url = env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not configured')
  }
  if (!cachedConnection || cachedConnection.url !== url) {
    cachedConnection = {
      url,
      connection: connect({ url }),
    }
  }
  return cachedConnection.connection
}

export async function runQuery<T = unknown>(env: DatabaseEnv, sql: string, params: Array<string | number | null> = []): Promise<T[]> {
  const conn = getDatabase(env)
  const result = await conn.execute(sql, params)
  const rows = result.rows as T[] | undefined
  return rows ? rows : []
}

export async function runQuerySingle<T = unknown>(env: DatabaseEnv, sql: string, params: Array<string | number | null> = []): Promise<T | null> {
  const rows = await runQuery<T>(env, sql, params)
  return rows.length ? rows[0] : null
}
