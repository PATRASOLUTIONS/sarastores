import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const target = resolve('.env.indexnow.local')
if (existsSync(target)) {
  console.log('Existing .env.indexnow.local preserved. Copy its IndexNow variables into Vercel Production settings.')
} else {
  writeFileSync(target, `# Generated IndexNow setup. This file is ignored by Git and is not loaded automatically.\n# Copy these two variables into Vercel Production environment variables, then deploy.\nINDEXNOW_KEY=${randomBytes(32).toString('hex')}\nINDEXNOW_ENABLED=true\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  console.log('Created .env.indexnow.local with a generated verification key. No provider contacted or database changed.')
}
