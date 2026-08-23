import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const sql = neon(dbUrl);

  // Get businesses from SECOND RUN specifically (created after 2026-08-21T11:00:00Z)
  const secondRunBusinesses = await sql`
    SELECT b.id, b.name, b.website, b.verification_status, b.source, b.discovered_at
    FROM businesses b
    WHERE b.city = 'Toronto' AND b.country = 'CA' AND b.discovered_at > '2026-08-21T11:00:00Z'
    ORDER BY b.discovered_at DESC
    LIMIT 20
  `;
  console.log('SECOND RUN BUSINESSES:', JSON.stringify(secondRunBusinesses, null, 2));

  const businessIds = secondRunBusinesses.map(b => b.id);
  if (businessIds.length === 0) {
    console.log('No second run businesses found');
    return;
  }
  const idsStr = businessIds.map(id => `'${id}'`).join(',');

  // Get ALL evidence for second run businesses
  const ev = await sql.query(`
    SELECT ei.id, ei.business_id, ei.category, ei.statement, ei.source_type, ei.confidence, ei.observed_at
    FROM evidence_items ei
    WHERE ei.business_id IN (${idsStr})
    ORDER BY ei.observed_at DESC
  `);
  console.log('\nSECOND RUN BUSINESSES EVIDENCE COUNT:', ev.length);
  
  // Count by source_type
  const bySource = await sql.query(`
    SELECT ei.source_type, COUNT(*) as count
    FROM evidence_items ei
    WHERE ei.business_id IN (${idsStr})
    GROUP BY ei.source_type
  `);
  console.log('\nEVIDENCE BY SOURCE TYPE:', JSON.stringify(bySource, null, 2));

  // Count by category
  const byCategory = await sql.query(`
    SELECT ei.category, COUNT(*) as count
    FROM evidence_items ei
    WHERE ei.business_id IN (${idsStr})
    GROUP BY ei.category
  `);
  console.log('\nEVIDENCE BY CATEGORY:', JSON.stringify(byCategory, null, 2));

  // Also get evidence by observed_at hour to see run separation
  const byHour = await sql.query(`
    SELECT DATE_TRUNC('hour', ei.observed_at) as hour, COUNT(*) as count
    FROM evidence_items ei
    WHERE ei.business_id IN (${idsStr})
    GROUP BY DATE_TRUNC('hour', ei.observed_at)
    ORDER BY hour DESC
  `);
  console.log('\nEVIDENCE BY HOUR:', JSON.stringify(byHour, null, 2));
}

main().catch(e => console.error('Error:', e));