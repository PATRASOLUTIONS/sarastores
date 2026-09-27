const { chromium } = require('C:\\Users\\nabap\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\.pnpm\\playwright-core@1.60.0\\node_modules\\playwright-core');
const fs = require('fs');
const path = require('path');

const files = ['g.js', 'v4.css', 'v4-home.js', 'v4-store.js', 'v4-admin.js', 'v4-rest.js'];
let code = '';
for (const f of files) {
  const content = fs.readFileSync(path.join(__dirname, f), 'utf8');
  if (f.endsWith('.css')) {
    code += `const CSS = \`${content}\`;\n`;
  } else {
    code += content + '\n';
  }
}

code += `
const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1200"><title>Sara Electronics - Complete Wireframe Document</title><style>' + CSS + '</style></head><body>' + pages.join('\\n') + '</body></html>';

(async () => {
  console.log('HTML size:', (html.length / 1024).toFixed(0), 'KB');
  console.log('Pages:', pageNum);
  const browser = await chromium.launch({
    executablePath: 'C:\\\\Users\\\\nabap\\\\AppData\\\\Local\\\\ms-playwright\\\\chromium-1200\\\\chrome-win64\\\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const pg = await browser.newPage();
  await pg.setContent(html, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1000);
  const pdfPath = require('path').join(__dirname, 'Sara-Electronics-Wireframes.pdf');
  await pg.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  await browser.close();
  const stats = require('fs').statSync(pdfPath);
  console.log('PDF:', pdfPath);
  console.log('Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
})().catch(err => { console.error('Error:', err.message); process.exit(1); });
`;

fs.writeFileSync(path.join(__dirname, '_run.js'), code);
console.log('Combined:', (code.length / 1024).toFixed(0), 'KB');
