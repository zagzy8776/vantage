import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const sql = neon(dbUrl);

  const businesses = await sql`
    SELECT b.id, b.name, b.website, b.verification_status, b.source, b.discovered_at
    FROM businesses b
    WHERE b.city = 'Toronto' AND b.country = 'CA' AND b.source = 'web'
    ORDER BY b.discovered_at DESC
    LIMIT 20
  `;
  const businessIds = businesses.map(b => b.id);
  const idsStr = businessIds.map(id => `'${id}'`).join(',');
  console.log('IDs:', idsStr);

  const ev = await sql.query(`
    SELECT ei.id, ei.business_id, ei.category, ei.source_type
    FROM evidence_items ei
    WHERE ei.business_id IN (${idsStr})
    ORDER BY ei.observed_at DESC
    LIMIT 10
  `);
  console.log('Result type:', typeof ev);
  console.log('Result keys:', Object.keys(ev));
  console.log('Result:', JSON.stringify(ev, null, 2));
}

main().catch(e => console.error('Error:', e));