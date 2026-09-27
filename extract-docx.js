const fs = require('fs');
const path = require('path');
const p = path.join(process.env.TEMP, 'docx_extract', 'word', 'document.xml');
let x = fs.readFileSync(p, 'utf8');
x = x.replace(/<w:p\b[^>]*>/g, '\n').replace(/<w:tab\/>/g, '\t');
let t = x.replace(/<[^>]+>/g, '');
t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
console.log(t);
