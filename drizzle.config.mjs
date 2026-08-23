/**
 * Minimal Drizzle Kit configuration for the existing Neon + Drizzle ORM setup.
 * The repository keeps append-only SQL migrations in src/lib/db/migrations.
 */
const config = {
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};

export default config;