// src/db/db.ts
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import "dotenv/config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL in your .env file!");
}

// 1. Create a native PostgreSQL pool using your Supabase connection string
const pool = new pg.Pool({
  connectionString: databaseUrl,
});

// 2. Instantiate the official Prisma adapter wrapper
const adapter = new PrismaPg(pool);

// 3. Pass the fully compliant adapter to your client
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: adapter as any, // "as any" bypasses any strict custom type constraints cleanly
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}