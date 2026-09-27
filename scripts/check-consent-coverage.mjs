#!/usr/bin/env node
/**
 * Read-only: reports marketing-consent coverage across customer_profiles.
 *
 * Every retention job gates sends on consent, so scheduling them is pointless
 * if nobody has opted in. This shows whether the pipeline can reach anyone.
 *
 * Usage: node scripts/check-consent-coverage.mjs
 */
import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set")
  process.exit(1)
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || "e-commerce-bytewise")

const profiles = db.collection("customer_profiles")
const users = db.collection("users")

const totalUsers = await users.countDocuments({})
const totalProfiles = await profiles.countDocuments({})

const emailOn = await profiles.countDocuments({ "consent.email": true })
const whatsappOn = await profiles.countDocuments({ "consent.whatsapp": true })
const smsOn = await profiles.countDocuments({ "consent.sms": true })
const noConsentField = await profiles.countDocuments({ consent: { $exists: false } })

const carts = await db.collection("carts").countDocuments({})
const wishlists = await db.collection("wishlists").countDocuments({})

console.log(`\n  users                    : ${totalUsers}`)
console.log(`  customer_profiles        : ${totalProfiles}`)
console.log(`    consent.email    true  : ${emailOn}`)
console.log(`    consent.whatsapp true  : ${whatsappOn}`)
console.log(`    consent.sms      true  : ${smsOn}`)
console.log(`    no consent field       : ${noConsentField}`)
console.log(`\n  carts                    : ${carts}`)
console.log(`  wishlists                : ${wishlists}`)

if (emailOn === 0 && whatsappOn === 0) {
  console.log(`\n  >> No profile has opted in. Every retention job will run,`)
  console.log(`     find candidates, and skip them all for consent.`)
  console.log(`     Scheduling alone will not produce a single message.\n`)
} else {
  console.log(`\n  ${emailOn} profile(s) can receive marketing email.\n`)
}

await client.close()
