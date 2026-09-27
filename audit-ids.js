const http = require('http');

async function auditIds() {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/products?limit=500&include_inactive=true',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                const products = Array.isArray(json) ? json : (json.data?.products || json.products || []);
                console.log('Total products:', products.length);

                let missingCount = 0;
                products.forEach((p, i) => {
                    if (!p.id && !p._id) {
                        missingCount++;
                        if (missingCount <= 5) {
                            console.log(`Product ${i} is missing both id and _id! Name: "${p.name}"`);
                        }
                    }
                });

                console.log('Products missing both id and _id:', missingCount);
            } catch (e) {
                console.error('Parse Error:', e.message);
            }
        });
    });

    req.on('error', (e) => console.error(e));
    req.end();
}

auditIds();
