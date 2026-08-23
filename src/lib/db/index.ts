import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

let dbInstance: ReturnType<typeof drizzle> | null = null;
let dbConnectionString: string | null = null;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!dbInstance || dbConnectionString !== connectionString) {
    const sql = neon(connectionString);
    dbInstance = drizzle(sql);
    dbConnectionString = connectionString;
  }

  return dbInstance;
}