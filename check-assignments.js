const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');

async function checkAssignments() {
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

        console.log(`--- Assignments for Partner ${partnerId} ---`);
        const assignments = await db.collection('partner_products').find({ partnerId, enabled: true }).toArray();
        console.log(`Found ${assignments.length} enabled assignments.`);

        if (assignments.length > 0) {
            const productIds = assignments.map(a => a.productId);
            const objectIds = productIds.map(id => {
                try { return new ObjectId(id); } catch { return null; }
            }).filter(Boolean);

            const products = await db.collection('products').find({
                $or: [
                    { _id: { $in: objectIds } },
                    { _id: { $in: productIds } }
                ]
            }).toArray();
            console.log(`Matched products: ${products.length}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

checkAssignments();
