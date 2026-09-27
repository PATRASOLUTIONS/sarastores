const http = require('http');

async function exhaustiveAudit() {
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
                console.log('Total products in API:', products.length);

                let validIdCount = 0;
                let valid_IdCount = 0;
                let bothFalsy = 0;

                products.forEach((p, i) => {
                    const hasId = !!p.id && typeof p.id === 'string' && p.id.trim() !== '';
                    const has_Id = !!p._id && (typeof p._id === 'string' || typeof p._id === 'object');

                    if (hasId) validIdCount++;
                    if (has_Id) valid_IdCount++;
                    if (!hasId && !has_Id) {
                        bothFalsy++;
                        console.log(`Product ${i} (Name: "${p.name}") has NO valid ID fields. Keys: ${Object.keys(p)}`);
                    }
                });

                console.log('Valid "id" count:', validIdCount);
                console.log('Valid "_id" count:', valid_IdCount);
                console.log('Both falsy count:', bothFalsy);

            } catch (e) {
                console.error('Parse Error:', e.message);
            }
        });
    });

    req.on('error', (e) => console.error(e));
    req.end();
}

exhaustiveAudit();
