import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SRC = process.argv[2] || '.env'
const EDGE_OUT = process.argv[3] || 'edge/secrets.env'
const CORE_OUT = process.argv[4] || 'core/.env'
const APP_OUT = process.argv[5] || 'app/.env.local'

function parseEnv(text) {
  const map = new Map()
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    if (!line || /^\s*#/.test(line)) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1)

    // Trim right whitespace
    val = val.replace(/\s+$/, '')

    // If quoted, strip the wrapping quotes only
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    } else {
      // Strip inline comments starting with space then #
      const hash = val.indexOf(' #')
      if (hash !== -1) {
        val = val.slice(0, hash)
      } else {
        // If value starts with # (after trimming), treat as empty
        if (/^\s*#/.test(val)) val = ''
      }
      val = val.trim()
    }
    map.set(key, val)
  }
  return map
}

function expandValue(val, env, depth = 0) {
  if (depth > 4) return val // prevent deep recursion
  return val.replace(/\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/g, (_, a, b) => {
    const name = a || b
    if (!name) return ''
    const repl = env.get(name) ?? process.env[name]
    if (repl == null) return ''
    return expandValue(String(repl), env, depth + 1)
  })
}

function expandAll(raw) {
  const out = new Map(raw)
  for (const [k, v] of raw.entries()) {
    out.set(k, expandValue(v, out))
  }
  return out
}

function writeEnv(path, keys, env, header) {
  mkdirSync(dirname(path), { recursive: true })
  const lines = []
  if (header) {
    lines.push(`# ${header}`)
    lines.push(`# Generated from ${SRC}`)
    lines.push('')
  }
  for (const k of keys) {
    if (!env.has(k)) continue
    const val = String(env.get(k))
    lines.push(`${k}=${val}`)
  }
  writeFileSync(path, lines.join('\n') + '\n')
}

let raw
try {
  raw = readFileSync(SRC, 'utf8')
} catch (e) {
  console.error(`Source env not found: ${SRC}`)
  process.exit(1)
}

const rawMap = parseEnv(raw)
const env = expandAll(rawMap)

const EDGE_KEYS = [
  'SESSION_SECRET',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_WEBHOOK_SECRET',
  'GITHUB_OAUTH_CLIENT_ID',
  'GITHUB_OAUTH_CLIENT_SECRET',
  'STRIPE_SECRET',
  'STRIPE_WEBHOOK_SECRET',
  'DATABASE_URL',
  'NATS_AUTH_TOKEN',
  'OTLP_HEADERS',
]

const CORE_KEYS = [
  'DATABASE_URL',
  'NATS_URL',
  'NATS_AUTH_TOKEN',
  'NATS_CREDS_FILE',
  'R2_S3_ENDPOINT',
  'R2_ACCESS_KEY',
  'R2_SECRET_KEY',
  'R2_BUCKET',
  'OTLP_HEADERS',
  'SESSION_SECRET',
  'ADMIN_SECRET',
]

const APP_KEYS = [
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_GITHUB_CLIENT_ID',
  'NEXT_PUBLIC_APP_ORIGIN',
  'NEXT_PUBLIC_API_ORIGIN',
]

writeEnv(EDGE_OUT, EDGE_KEYS, env, 'Workers secrets (for wrangler secret put)')
writeEnv(CORE_OUT, CORE_KEYS, env, 'Core runner env')
writeEnv(APP_OUT, APP_KEYS, env, 'Next.js public env')

console.log('Synced:')
console.log('  - ' + EDGE_OUT)
console.log('  - ' + CORE_OUT)
console.log('  - ' + APP_OUT)
