const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" +
                  " AppleWebKit/537.36 (KHTML, like Gecko)" +
                  " Chrome/116.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
};

async function getHtml(url) {
    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    return response.data;
}

function extractTitle($) {
    const title = $('#productTitle').text();
    return title ? title.trim() : null;
}

function extractAsin(url, $) {
    const m = url.match(/\/dp\/([A-Z0-9]{10})/);
    if (m) return m[1];
    const th = $('th').filter((i, el) => $(el).text().match(/ASIN/i)).first();
    if (th.length) {
        const val = th.next('td').text();
        if (val) return val.trim();
    }
    return null;
}

function extractTechnicalDetails($) {
    const details = {};
    $('#productDetails_techSpec_section_1 tr').each((i, el) => {
        const key = $(el).find('th').text().trim();
        const val = $(el).find('td').text().trim();
        if (key) details[key] = val;
    });
    $('#productDetails_detailBullets_sections1 tr').each((i, el) => {
        const cols = $(el).find('td');
        if (cols.length >= 2) {
            const key = $(cols[0]).text().trim();
            const val = $(cols[1]).text().trim();
            details[key] = val;
        }
    });
    $('#detailBullets_feature_div li').each((i, el) => {
        const txt = $(el).text().replace(/\s+/g, ' ').trim();
        const idx = txt.indexOf(':');
        if (idx !== -1) {
            const k = txt.slice(0, idx).trim();
            const v = txt.slice(idx + 1).trim();
            details[k] = v;
        }
    });
    return details;
}

function extractFromManufacturer($) {
    const h2 = $('h2').filter((i, el) => $(el).text().match(/From the manufacturer/i)).first();
    if (h2.length) {
        const nxt = h2.next();
        if (nxt.length) return nxt.text().replace(/\s+/g, ' ').trim();
    }
    const desc = $('#productDescription').text();
    if (desc) return desc.replace(/\s+/g, ' ').trim();
    return null;
}

function extractImages($, html) {
    const images = new Set();
    const img = $('#landingImage');
    if (img.length && img.attr('data-a-dynamic-image')) {
        try {
            const data = JSON.parse(img.attr('data-a-dynamic-image'));
            Object.keys(data).forEach(url => images.add(url));
        } catch {}
    }
    // Try to extract from ImageBlockATF
    const m = html.match(/'ImageBlockATF':\s*({.*?})\s*,\n/s);
    if (m) {
        try {
            const ib = JSON.parse(m[1].replace(/'/g, '"'));
            if (ib.mainUrl) images.add(ib.mainUrl);
            if (ib.variant) {
                Object.values(ib.variant).forEach(v => {
                    if (typeof v === 'object') {
                        images.add(v.hiRes || v.large || v.main);
                    }
                });
            }
        } catch {}
    }
    $('#altImages img').each((i, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src');
        if (src) images.add(src.split('_')[0] + '.jpg');
    });
    return Array.from(images).filter(Boolean);
}

async function scrapeAmazon(url) {
    const html = await getHtml(url);
    const $ = cheerio.load(html);
    return {
        url,
        title: extractTitle($),
        asin: extractAsin(url, $),
        technical_details: extractTechnicalDetails($),
        from_manufacturer: extractFromManufacturer($),
        images: extractImages($, html)
    };
}

// Vercel API handler
module.exports = async (req, res) => {
    const { url } = req.query;
    if (!url) {
        res.status(400).json({ error: "Missing url parameter" });
        return;
    }
    try {
        const product = await scrapeAmazon(url);
        res.status(200).json(product);
    } catch (err) {
        res.status(500).json({ error: err.message || "Scraping failed" });
    }
};