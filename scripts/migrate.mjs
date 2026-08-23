import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(root, "src", "lib", "db", "migrations");

function loadLocalEnv() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

loadLocalEnv();
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

function splitSql(text) {
  const statements = [];
  let start = 0;
  let inDollarBlock = false;
  for (let index = 0; index < text.length; index += 1) {
    if (text.slice(index, index + 2) === "$$") {
      inDollarBlock = !inDollarBlock;
      index += 1;
      continue;
    }
    if (text[index] === ";" && !inDollarBlock) {
      const statement = text.slice(start, index + 1).trim();
      if (statement) statements.push(statement.replace(/(^|\n)\s*--[^\n]*/g, "").trim());
      start = index + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) statements.push(tail.replace(/(^|\n)\s*--[^\n]*/g, "").trim());
  return statements;
}

const sql = neon(connectionString);
await sql`CREATE TABLE IF NOT EXISTS _vantage_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
const appliedRows = await sql`SELECT filename FROM _vantage_migrations ORDER BY filename`;
const applied = new Set(appliedRows.map((row) => row.filename));
const files = fs.readdirSync(migrationDirectory).filter((file) => /^\d{4}_.*\.sql$/.test(file)).sort();

for (const filename of files) {
  if (applied.has(filename)) {
    console.log(`${filename}:already-applied`);
    continue;
  }
  const content = fs.readFileSync(path.join(migrationDirectory, filename), "utf8");
  for (const statement of splitSql(content)) await sql.query(statement);
  await sql`INSERT INTO _vantage_migrations (filename) VALUES (${filename})`;
  console.log(`${filename}:applied`);
}