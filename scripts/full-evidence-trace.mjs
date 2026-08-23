import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const sql = neon(dbUrl);

  // Get businesses from second run (web sources)
  const businesses = await sql`
    SELECT b.id, b.name, b.website, b.verification_status, b.source, b.discovered_at
    FROM businesses b
    WHERE b.city = 'Toronto' AND b.country = 'CA' AND b.source = 'web'
    ORDER BY b.discovered_at DESC
    LIMIT 20
  `;
  const businessIds = businesses.map(b => b.id);
  const idsStr = businessIds.map(id => `'${id}'`).join(',');

  // Get ALL evidence for web businesses
  const ev = await sql.query(`
    SELECT ei.id, ei.business_id, ei.category, ei.statement, ei.source_type, ei.confidence, ei.observed_at
    FROM evidence_items ei
    WHERE ei.business_id IN (${idsStr})
    ORDER BY ei.observed_at DESC
  `);
  console.log('WEB BUSINESSES EVIDENCE COUNT:', ev.length);
  console.log('WEB BUSINESSES EVIDENCE:', JSON.stringify(ev, null, 2));

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

  // Also get Foursquare/Yelp businesses from second run
  const foursquareYelp = await sql`
    SELECT b.id, b.name, b.website, b.verification_status, b.source, b.discovered_at
    FROM businesses b
    WHERE b.city = 'Toronto' AND b.country = 'CA' AND b.source IN ('foursquare', 'yelp')
    ORDER BY b.discovered_at DESC
    LIMIT 20
  `;
  console.log('\nBUSINESSES (foursquare/yelp):', JSON.stringify(foursquareYelp, null, 2));

  const fyIds = foursquareYelp.map(b => b.id);
  if (fyIds.length > 0) {
    const fyIdsStr = fyIds.map(id => `'${id}'`).join(',');
    const fyEv = await sql.query(`
      SELECT ei.id, ei.business_id, ei.category, ei.statement, ei.source_type, ei.confidence, ei.observed_at
      FROM evidence_items ei
      WHERE ei.business_id IN (${fyIdsStr})
      ORDER BY ei.observed_at DESC
    `);
    console.log('\nEVIDENCE FOR FOURSQUARE/YELP BUSINESSES COUNT:', fyEv.length);
    console.log('EVIDENCE FOR FOURSQUARE/YELP:', JSON.stringify(fyEv, null, 2));

    const fyBySource = await sql.query(`
      SELECT ei.source_type, COUNT(*) as count
      FROM evidence_items ei
      WHERE ei.business_id IN (${fyIdsStr})
      GROUP BY ei.source_type
    `);
    console.log('\nFY EVIDENCE BY SOURCE TYPE:', JSON.stringify(fyBySource, null, 2));
  }
}

main().catch(e => console.error('Error:', e));