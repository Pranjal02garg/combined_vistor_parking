const path = require('path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const argon2 = require('argon2');

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
  
  const passwordHash = await argon2.hash('HelloAdmin123!@#', {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  
  const result = await db.collection('users').updateOne(
    { email: 'admin@example.com' },
    {
      $set: {
        passwordHash,
        role: 'admin',
        isActive: true,
        parkingEligible: false,
        name: 'Super Admin',
        updatedAt: new Date()
      },
      $setOnInsert: {
        failedLoginAttempts: 0,
        lockUntil: null,
        createdAt: new Date()
      }
    },
    { upsert: true }
  );
  
  if (result.upsertedCount > 0) {
    console.log('Test admin created successfully (admin@example.com / HelloAdmin123!@#).');
  } else {
    console.log('Test admin credentials updated successfully.');
  }
  
  await client.close();
}

run().catch(console.error);
