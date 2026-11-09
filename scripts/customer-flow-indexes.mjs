// Additive, non-unique query indexes. Default is read-only preview; --apply creates indexes.
import { MongoClient } from 'mongodb'
export const FLOW_INDEXES = [
  ['analytics_events',{createdAt:1}], ['analytics_events',{visitorId:1,userId:1,createdAt:1}],
  ['analytics_events',{userId:1,event:1,createdAt:1}],
  ['orders',{createdAt:1}], ['orders',{updatedAt:1}], ['orders',{'statusHistory.timestamp':1}],
  ['orders',{'paymentVerification.verifiedAt':1}], ['checkout_intents',{createdAt:1}],
  ['carts',{userId:1}],
]
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required')
const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:8000})
try {
  await client.connect()
  const db=client.db(process.env.MONGODB_DB || process.env.DB_NAME || 'e-commerce-bytewise')
  for (const [collection,key] of FLOW_INDEXES) {
    const existing=await db.collection(collection).listIndexes().toArray().catch(()=>[])
    const found=existing.some(i=>JSON.stringify(i.key)===JSON.stringify(key))
    const name=`flow_${Object.keys(key).join('_').replaceAll('.','_')}`
    if (!found && process.argv.includes('--apply'))await db.collection(collection).createIndex(key,{name})
    console.log(JSON.stringify({collection,key,status:found?'present':process.argv.includes('--apply')?'created':'missing'}))
  }
}catch{console.error('Index preparation failed. No customer data was printed.');process.exitCode=1}
finally{await client.close()}
