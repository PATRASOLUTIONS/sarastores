const { chromium } = require('C:\\Users\\nabap\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\.pnpm\\playwright-core@1.60.0\\node_modules\\playwright-core');
const fs = require('fs');
const path = require('path');

const files = ['part1.js', 'part2.js', 'pages-toc.js', 'pages-storefront.js', 'pages-auth-cart.js', 'pages-dashboard.js', 'pages-admin.js', 'pages-admin2.js', 'pages-vendor-sw.js', 'pages-info-seo.js'];
let allCode = '';
for (const f of files) {
  allCode += fs.readFileSync(path.join(__dirname, f), 'utf8') + '\n';
}

eval(allCode);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1200">
<title>Sara Electronics — Complete Wireframe Document</title>
<style>${CSS}</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;

(async () => {
  console.log('Assembled HTML:', (html.length / 1024).toFixed(0), 'KB');
  console.log('Total pages:', pageNum);

  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\nabap\\AppData\\Local\\ms-playwright\\chromium-1200\\chrome-win64\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const pdfPath = path.join(__dirname, '..', 'Sara-Electronics-Wireframes.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    displayHeaderFooter: false
  });

  await browser.close();
  const stats = fs.statSync(pdfPath);
  console.log('PDF generated:', pdfPath);
  console.log('Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
  console.log('Done!');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
