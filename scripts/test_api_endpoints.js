/*
Simple Node test script for the API endpoints used in export & bulk flows.
Usage:
  BASE_URL=http://localhost:3000 node scripts/test_api_endpoints.js

It will:
- GET /api/products/export and save the response body to ./test-output/products-export.xlsx
- POST /api/products/bulk with a small ids array and log response status/time

Requires Node 18+ (global fetch available). If you don't have Node 18, run with `node --experimental-fetch` or use a small wrapper.
*/

import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const EXPORT_URL = `${BASE_URL}/api/products/export`;
const BULK_URL = `${BASE_URL}/api/products/bulk`;

async function fetchExport() {
  console.log('Requesting export:', EXPORT_URL);
  const res = await fetch(EXPORT_URL, { method: 'GET' });
  console.log('Export response status:', res.status, res.statusText);
  const contentType = res.headers.get('content-type') || '';
  console.log('Content-Type:', contentType);
  const outDir = path.join(process.cwd(), 'test-output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outPath = path.join(outDir, 'products-export.xlsx');
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
  console.log('Saved export to', outPath, 'size:', buffer.length);
}

async function postBulk() {
  const sampleIds = [
    // replace with real product ids to exercise real code paths
    '000000000000000000000000',
    '000000000000000000000001'
  ];
  console.log('Posting to bulk endpoint:', BULK_URL);
  const start = Date.now();
  let res;
  try {
    res = await fetch(BULK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: sampleIds })
    });
  } catch (err) {
    console.error('Bulk request failed:', err.message);
    return;
  }
  const elapsed = Date.now() - start;
  console.log('Bulk response status:', res.status, res.statusText, 'in', elapsed, 'ms');
  let text;
  try {
    text = await res.text();
    console.log('Bulk response body (truncated):', text.slice(0, 200));
  } catch (err) {
    console.warn('Failed to read bulk response body:', err.message);
  }
}

async function run() {
  await fetchExport().catch(e => console.error('Export error:', e.message));
  await postBulk();
}

run();
