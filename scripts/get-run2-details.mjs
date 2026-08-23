import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  const sql = neon(dbUrl);
  
  // Get businesses for latest run (by checking discovered_at)
  const businesses = await sql`
    SELECT b.id, b.name, b.website, b.verification_status, b.source, b.city, b.country,
           l.id as lead_id, l.opportunity_score, l.website_status, l.ai_opportunity_score, l.ai_opportunity_level
    FROM businesses b
    LEFT JOIN leads l ON l.business_id = b.id
    WHERE b.city = 'Toronto' AND b.country = 'CA'
    ORDER BY b.discovered_at DESC
    LIMIT 20
  `;
  console.log('BUSINESSES WITH LEADS:', JSON.stringify(businesses, null, 2));
  
  // Get website analyses
  const wa = await sql`
    SELECT wa.id, wa.business_id, wa.url, wa.strategy, wa.performance_score, wa.accessibility_score, 
           wa.best_practices_score, wa.seo_score, wa.status, wa.error_code, wa.analyzed_at
    FROM website_analyses wa
    JOIN businesses b ON b.id = wa.business_id
    WHERE b.city = 'Toronto' AND b.country = 'CA'
    ORDER BY wa.analyzed_at DESC
    LIMIT 20
  `;
  console.log('\nWEBSITE ANALYSES:', JSON.stringify(wa, null, 2));
  
  // Get AI analyses
  const ai = await sql`
    SELECT aa.id, aa.business_id, aa.lead_id, aa.provider, aa.model, aa.status, 
           aa.opportunity_score, aa.opportunity_level, aa.error_code, aa.fallback_used, aa.attempts, aa.created_at
    FROM ai_analyses aa
    JOIN businesses b ON b.id = aa.business_id
    WHERE b.city = 'Toronto' AND b.country = 'CA'
    ORDER BY aa.created_at DESC
    LIMIT 20
  `;
  console.log('\nAI ANALYSES:', JSON.stringify(ai, null, 2));
  
  // Get evidence items
  const ev = await sql`
    SELECT ei.id, ei.business_id, ei.category, ei.statement, ei.source_type, ei.confidence, ei.observed_at
    FROM evidence_items ei
    JOIN businesses b ON b.id = ei.business_id
    WHERE b.city = 'Toronto' AND b.country = 'CA'
    ORDER BY ei.observed_at DESC
    LIMIT 30
  `;
  console.log('\nEVIDENCE ITEMS:', JSON.stringify(ev, null, 2));
  
  // Get conflicts
  const conf = await sql`
    SELECT ec.id, ec.business_id, ec.category, ec.field_key, ec.status, ec.observed_at
    FROM evidence_conflicts ec
    JOIN businesses b ON b.id = ec.business_id
    WHERE b.city = 'Toronto' AND b.country = 'CA'
    ORDER BY ec.observed_at DESC
    LIMIT 10
  `;
  console.log('\nEVIDENCE CONFLICTS:', JSON.stringify(conf, null, 2));
  
  // Get business relationships
  const rel = await sql`
    SELECT br.id, br.left_business_id, br.right_business_id, br.confidence, br.status, br.created_at
    FROM business_relationships br
    JOIN businesses bl ON bl.id = br.left_business_id
    JOIN businesses br2 ON br2.id = br.right_business_id
    WHERE bl.city = 'Toronto' AND bl.country = 'CA'
    ORDER BY br.created_at DESC
    LIMIT 10
  `;
  console.log('\nBUSINESS RELATIONSHIPS:', JSON.stringify(rel, null, 2));
}

main().catch(e => console.error('Error:', e));