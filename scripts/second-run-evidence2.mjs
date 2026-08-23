import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const sql = neon(dbUrl);

  // Get the second run's stored IDs from search_runs
  const runs = await sql`
    SELECT id, stored_ids, result
    FROM search_runs
    WHERE id = 'run_1787310590950_isvvv8'
  `;
  console.log('SECOND RUN:', JSON.stringify(runs, null, 2));

  // Parse stored_ids from the result
  const run = runs[0];
  if (run && run.result) {
    const result = typeof run.result === 'string' ? JSON.parse(run.result) : run.result;
    const storedIds = result.storedIds || [];
    console.log('STORED IDS:', storedIds);

    if (storedIds.length > 0) {
      const idsStr = storedIds.map(id => `'${id}'`).join(',');
      
      // Get businesses for these leads
      const businesses = await sql.query(`
        SELECT b.id, b.name, b.website, b.verification_status, b.source, b.discovered_at, b.updated_at
        FROM businesses b
        JOIN leads l ON l.business_id = b.id
        WHERE l.id IN (${idsStr})
      `);
      console.log('\nSECOND RUN BUSINESSES:', JSON.stringify(businesses.rows, null, 2));

      const businessIds = businesses.rows.map(b => b.id);
      if (businessIds.length > 0) {
        const bizIdsStr = businessIds.map(id => `'${id}'`).join(',');
        
        // Get ALL evidence for these businesses
        const ev = await sql.query(`
          SELECT ei.id, ei.business_id, ei.category, ei.statement, ei.source_type, ei.confidence, ei.observed_at
          FROM evidence_items ei
          WHERE ei.business_id IN (${bizIdsStr})
          ORDER BY ei.observed_at DESC
        `);
        console.log('\nSECOND RUN BUSINESSES EVIDENCE COUNT:', ev.rows.length);
        
        // Count by source_type
        const bySource = await sql.query(`
          SELECT ei.source_type, COUNT(*) as count
          FROM evidence_items ei
          WHERE ei.business_id IN (${bizIdsStr})
          GROUP BY ei.source_type
        `);
        console.log('\nEVIDENCE BY SOURCE TYPE:', JSON.stringify(bySource.rows, null, 2));

        // Count by category
        const byCategory = await sql.query(`
          SELECT ei.category, COUNT(*) as count
          FROM evidence_items ei
          WHERE ei.business_id IN (${bizIdsStr})
          GROUP BY ei.category
        `);
        console.log('\nEVIDENCE BY CATEGORY:', JSON.stringify(byCategory.rows, null, 2));

        // By hour
        const byHour = await sql.query(`
          SELECT DATE_TRUNC('hour', ei.observed_at) as hour, COUNT(*) as count
          FROM evidence_items ei
          WHERE ei.business_id IN (${bizIdsStr})
          GROUP BY DATE_TRUNC('hour', ei.observed_at)
          ORDER BY hour DESC
        `);
        console.log('\nEVIDENCE BY HOUR:', JSON.stringify(byHour.rows, null, 2));
      }
    }
  }
}

main().catch(e => console.error('Error:', e));