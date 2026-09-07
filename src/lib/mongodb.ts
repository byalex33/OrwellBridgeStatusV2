import { MongoClient } from 'mongodb';

const globalWithMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

export default function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return Promise.reject(new Error('Missing MONGODB_URI'));
  if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
      socketTimeoutMS: 2000,
      waitQueueTimeoutMS: 2000,
      timeoutMS: 2000,
    });
    globalWithMongo._mongoClientPromise = client.connect().catch(async error => {
      globalWithMongo._mongoClientPromise = undefined;
      await client.close().catch(() => undefined);
      throw error;
    });
  }
  return globalWithMongo._mongoClientPromise;
}
