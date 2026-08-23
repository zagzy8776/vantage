import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  const sql = neon(dbUrl);

  const runs = await sql`
    SELECT id, status, completed_at, duration_ms, discovered_count, enriched_count, 
           official_domains_identified, firecrawl_enriched, 
           verified_count, rejected_count, stages, provider_metrics
    FROM search_runs 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  console.log('RUNS:', JSON.stringify(runs, null, 2));
}

main().catch(e => console.error('Error:', e));