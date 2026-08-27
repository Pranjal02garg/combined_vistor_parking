import { Db, MongoClient } from "mongodb";

import { getMongoEnv } from "@/lib/env";

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function getMongoClientPromise(): Promise<MongoClient> {
  if (!globalThis.__mongoClientPromise) {
    const { MONGODB_URI } = getMongoEnv();
    const client = new MongoClient(MONGODB_URI);
    globalThis.__mongoClientPromise = client.connect();
  }

  return globalThis.__mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const { MONGODB_DB_NAME } = getMongoEnv();
  const mongoClient = await getMongoClientPromise();
  return mongoClient.db(MONGODB_DB_NAME);
}
