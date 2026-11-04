import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'

const target = resolve('.env.local')
const existing = existsSync(target) ? readFileSync(target, 'utf8') : ''
const values = parseEnv(existing)
const additions = []
if (!values.INDEXNOW_KEY?.trim()) {
  if ('INDEXNOW_KEY' in values) throw new Error('INDEXNOW_KEY is empty in .env.local. Set it there before running setup again.')
  additions.push(`INDEXNOW_KEY=${randomBytes(32).toString('hex')}`)
}
if (!('INDEXNOW_ENABLED' in values)) additions.push('INDEXNOW_ENABLED=true')
if (additions.length) writeFileSync(target, existing + (existing && !existing.endsWith('\n') ? '\n' : '') + '\n# IndexNow production setup: copy these variables to Vercel Production.\n' + additions.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 })
console.log('IndexNow settings are in .env.local. Existing values and .env were preserved. No additional environment file or provider call was made.')
