const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');

async function inspectSample() {
    let uri = '';
    try {
        const env = fs.readFileSync('.env.local', 'utf8');
        const match = env.match(/MONGODB_URI=(.*)/);
        if (match) uri = match[1].trim();
    } catch (e) {
        console.error('Failed to read .env.local');
        return;
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('e-commerce-bytewise');
        const partnerId = '698f67bbc55edf4350e0ac3a';

        const assignments = await db.collection('partner_products').find({ partnerId, enabled: true }).limit(10).toArray();
        console.log(`--- Sample Assignments for Partner ${partnerId} ---`);
        assignments.forEach((a, i) => {
            console.log(`Assignment ${i}: productId="${a.productId}" (type: ${typeof a.productId})`);
        });

        // Also check one product in the products collection
        const sampleProduct = await db.collection('products').findOne({});
        if (sampleProduct) {
            console.log(`\nSample Product: _id=${sampleProduct._id} (type: ${typeof sampleProduct._id}), name="${sampleProduct.name}"`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

inspectSample();
