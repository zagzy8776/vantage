import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function main() {
  console.log('Starting DB check...');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  const sql = neon(dbUrl);
  console.log('SQL client created');
  
  const result = await sql`SELECT 1 as test`;
  console.log('DB connected:', result);
  
  // Check existing businesses from Toronto
  const businesses = await sql`
    SELECT id, name, website, verification_status, source, city, country
    FROM businesses 
    WHERE city = 'Toronto' AND country = 'CA'
    ORDER BY discovered_at DESC
    LIMIT 20
  `;
  console.log('Businesses:', JSON.stringify(businesses, null, 2));

// Check search runs
  const runs = await sql`
    SELECT id, status, completed_at, duration_ms, discovered_count, enriched_count, 
           official_domains_identified, firecrawl_enriched, 
           verified_count, rejected_count, stages
    FROM search_runs 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  console.log('Runs:', JSON.stringify(runs, null, 2));
}

main().catch(e => console.error('Error:', e));