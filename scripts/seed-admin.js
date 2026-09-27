#!/usr/bin/env node

/*
  Seed (or update) an admin user in the database.

  This replaces the previously hardcoded admin credentials that lived in the
  login route. Credentials are read from environment variables and the password
  is stored as a bcrypt hash.

  Usage (PowerShell):
    $env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="a-strong-password"; node scripts/seed-admin.js

  Or set ADMIN_EMAIL / ADMIN_PASSWORD in your .env file and run:
    node scripts/seed-admin.js
*/

const fs = require("fs")
const path = require("path")
const { MongoClient } = require("mongodb")
const bcrypt = require("bcryptjs")

// Minimal .env loader so the script works without extra dependencies.
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    const content = fs.readFileSync(full, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  }
}

async function main() {
  loadEnv()

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("MONGODB_URI is required")

  const dbName =
    process.env.DB_NAME || process.env.MONGODB_DB || process.env.MONGODB || "e-commerce-bytewise"

  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim()
  const password = process.env.ADMIN_PASSWORD || ""

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required")
  }
  if (password.length < 10) {
    throw new Error("ADMIN_PASSWORD must be at least 10 characters")
  }

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db(dbName)
    const users = db.collection("users")

    const hashedPassword = await bcrypt.hash(password, 12)
    const now = new Date()

    const result = await users.updateOne(
      { email },
      {
        $set: {
          name: "Administrator",
          email,
          password: hashedPassword,
          role: "admin",
          emailVerified: true,
          dashboardAccess: true,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now, cart: [], wishlist: [], orders: [] },
      },
      { upsert: true },
    )

    if (result.upsertedCount > 0) {
      console.log(`Created admin user: ${email}`)
    } else {
      console.log(`Updated existing user to admin: ${email}`)
    }
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error("seed-admin failed:", err.message || err)
  process.exit(1)
})
