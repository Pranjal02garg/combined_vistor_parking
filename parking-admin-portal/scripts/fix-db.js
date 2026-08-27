const path = require('path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

// Load environment variables from the project root
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('ERROR: MONGODB_URI not found. Please check your .env.local file at the root.');
  process.exit(1);
}

const dbName = process.env.MONGODB_DB_NAME || 'parking_app';
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db(dbName);
  
  const result = await db.collection('users').updateMany(
    { role: { $exists: false } },
    {
      $set: {
        role: 'admin',
        isActive: true,
        parkingEligible: false,
        eligibleFrom: null,
        eligibleTill: null,
        name: 'Legacy Admin'
      }
    }
  );
  
  console.log(`Successfully fixed legacy users in database. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
  await client.close();
}

run().catch(console.error);
