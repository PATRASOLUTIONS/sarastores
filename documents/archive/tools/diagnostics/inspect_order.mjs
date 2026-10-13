import { MongoClient, ObjectId } from "mongodb";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is not set. Refusing to run.');
        process.exit(1);
    }
    const dbName = 'e-commerce-bytewise';
    const client = new MongoClient(uri);
    const idValue = '699f3abdfdb14da6530afda6';

    try {
        await client.connect();
        const db = client.db(dbName);

        let objId = new ObjectId(idValue);
        let doc = await db.collection('partner_orders').findOne({ _id: objId });

        if (doc) {
            const output = fileURLToPath(new URL('../../../private-artifacts/audit/order_debug_dump.json', import.meta.url));
            fs.mkdirSync(fileURLToPath(new URL('../../../private-artifacts/audit/', import.meta.url)), { recursive: true });
            fs.writeFileSync(output, JSON.stringify(doc, null, 2));
            console.log('Order dumped to documents/private-artifacts/audit/order_debug_dump.json');
        } else {
            console.log('Order not found');
        }

    } catch (err) {
        console.error('SCRIPT ERROR:', err);
    } finally {
        await client.close();
    }
}

main().catch(console.error);
