const http = require('http');

async function inspectApiResponse() {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/products?limit=1&include_inactive=true',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log('Status:', res.statusCode);
            try {
                const json = JSON.parse(data);
                const products = Array.isArray(json) ? json : (json.data?.products || json.products || []);
                console.log('Products Length:', products.length);
                if (products.length > 0) {
                    const p = products[0];
                    console.log('Product Keys:', Object.keys(p));
                    console.log('Product _id:', p._id, '(type:', typeof p._id, ')');
                    console.log('Product id:', p.id, '(type:', typeof p.id, ')');
                    console.log('Product Name:', p.name);
                }
            } catch (e) {
                console.error('Parse Error:', e.message);
            }
        });
    });

    req.on('error', (e) => console.error(e));
    req.end();
}

inspectApiResponse();
