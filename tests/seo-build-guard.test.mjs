import { pathToFileURL } from "node:url"
import assert from "node:assert/strict"
import test from "node:test"
import path from "node:path"
import { execFileSync } from "node:child_process"

const root = path.resolve(import.meta.dirname, "..")
const guard = path.join(root, "scripts/seo/build-guard.mjs")
function run(code, fixtureMode = "catalogue-v2") {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    ["path", "systemroot", "windir", "temp", "tmp", "pathext"].includes(key.toLowerCase())))
  Object.assign(env, { MONGODB_URI: "mongodb://seo-fixture.invalid/synthetic", SARA_SEO_BUILD_FIXTURES: fixtureMode })
  return execFileSync(process.execPath, ["--import", pathToFileURL(guard).href, "-e", `
    const assert = require('node:assert/strict'); const { MongoClient } = require('mongodb');
    (async () => { ${code} })().catch(error => { console.error(error); process.exitCode = 1 })
  `], { cwd: root, env, encoding: "utf8", windowsHide: true })
}

test("isolated build reads cloned taxonomy and refuses unsupported collections, queries and writes", () => {
  assert.equal(run(`
    const client = await new MongoClient(process.env.MONGODB_URI).connect();
    const db = await Promise.resolve(client.db('synthetic'));
    const categories = await Promise.resolve(db.collection('categories'));
    const rows = await categories.find({}).toArray(); assert.equal(rows[0].slug, 'synthetic-phones');
    rows[0].slug = 'mutated'; assert.equal((await categories.find({}).toArray())[0].slug, 'synthetic-phones');
    assert.equal((await db.collection('sub_categories').find({}).toArray()).length, 1);
    assert.equal((await db.collection('articles').find({status:'published'}).sort({createdAt:-1}).limit(5).toArray())[0].slug, 'synthetic-guide');
    assert.throws(() => db.collection('orders'), /access refused/);
    assert.throws(() => categories.insertOne({}), /access refused/);
    assert.throws(() => categories.find({$where:'unsupported'}), /access refused/);
    assert.throws(() => db.command({ping:1}), /access refused/);
  `), "")
})

test("isolated build cannot connect to a real URI or opt out of fixtures", () => {
  assert.equal(run(`
    await assert.rejects(new MongoClient('mongodb://localhost/synthetic').connect(), /access refused/);
    assert.throws(() => new MongoClient('mongodb://localhost/synthetic').db(), /access refused/);
    assert.throws(() => MongoClient.connect(process.env.MONGODB_URI), /access refused/);
  `), "")
  assert.equal(run(`await assert.rejects(new MongoClient(process.env.MONGODB_URI).connect(), /access refused/);`, ""), "")
})

test("isolated build rejects external requests and hides local environment files", () => {
  assert.equal(run(`
    assert.throws(() => require('node:https').get('https://example.invalid/'), /access refused/);
    assert.throws(() => require('node:http').get('http://localhost/'), /access refused/);
    assert.throws(() => fetch('https://example.invalid/'), /access refused/);
    assert.equal(require('node:fs').readFileSync('.env.local', 'utf8'), '');
  `), "")
})

test("isolated build also hides synthetic environment files through named ESM imports", () => {
  assert.equal(run(`
    const fs = await import('node:fs');
    const filename = '.seo-local/.env.esm-fixture';
    fs.writeFileSync(filename, 'synthetic fixture only');
    assert.equal(fs.readFileSync(filename, 'utf8'), '');
    fs.unlinkSync(filename);
  `), "")
})
