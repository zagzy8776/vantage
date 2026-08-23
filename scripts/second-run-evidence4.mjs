import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const sql = neon(dbUrl);

  const storedIds = [
    'lead_yelp_c0HKX5jnC1MslLKpKJExcw',
    'lead_foursquare_672ec18c80e2c512f7e814ef',
    'lead_foursquare_4b782f50f964a52095ba2ee3',
    'lead_web_web_thecabinetsalon.com',
    'lead_web_web_emeraldhairandbeauty.com',
    'lead_web_web_perfectthreading.com',
    'lead_web_web_venusvictoriaspa.ca',
    'lead_web_web_figarosalon.com',
    'lead_web_web_evolvesalon.ca',
    'lead_web_web_pandhsalon.com'
  ];

  const idsStr = storedIds.map(id => `'${id}'`).join(',');
  
  // Get businesses for these leads
  const businessesResult = await sql.query(`
    SELECT b.id, b.name, b.website, b.verification_status, b.source, b.discovered_at, b.updated_at
    FROM businesses b
    JOIN leads l ON l.business_id = b.id
    WHERE l.id IN (${idsStr})
  `);
  const businesses = Array.isArray(businessesResult) ? businessesResult : businessesResult.rows || [];
  console.log('SECOND RUN BUSINESSES:', JSON.stringify(businesses, null, 2));

  const businessIds = businesses.map(b => b.id);
  if (businessIds.length > 0) {
    const bizIdsStr = businessIds.map(id => `'${id}'`).join(',');
    
    // Get ALL evidence for these businesses
    const ev = await sql.query(`
      SELECT ei.id, ei.business_id, ei.category, ei.statement, ei.source_type, ei.confidence, ei.observed_at
      FROM evidence_items ei
      WHERE ei.business_id IN (${bizIdsStr})
      ORDER BY ei.observed_at DESC
    `);
    const evidence = Array.isArray(ev) ? ev : ev.rows || [];
    console.log('\nSECOND RUN BUSINESSES EVIDENCE COUNT:', evidence.length);
    
    // Count by source_type
    const bySource = await sql.query(`
      SELECT ei.source_type, COUNT(*) as count
      FROM evidence_items ei
      WHERE ei.business_id IN (${bizIdsStr})
      GROUP BY ei.source_type
    `);
    console.log('\nEVIDENCE BY SOURCE TYPE:', JSON.stringify(bySource, null, 2));

    // Count by category
    const byCategory = await sql.query(`
      SELECT ei.category, COUNT(*) as count
      FROM evidence_items ei
      WHERE ei.business_id IN (${bizIdsStr})
      GROUP BY ei.category
    `);
    console.log('\nEVIDENCE BY CATEGORY:', JSON.stringify(byCategory, null, 2));

    // By hour
    const byHour = await sql.query(`
      SELECT DATE_TRUNC('hour', ei.observed_at) as hour, COUNT(*) as count
      FROM evidence_items ei
      WHERE ei.business_id IN (${bizIdsStr})
      GROUP BY DATE_TRUNC('hour', ei.observed_at)
      ORDER BY hour DESC
    `);
    console.log('\nEVIDENCE BY HOUR:', JSON.stringify(byHour, null, 2));
  }
}

main().catch(e => console.error('Error:', e));