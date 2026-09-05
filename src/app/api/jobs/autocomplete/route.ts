import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAuth } from "@/auth/middleware";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type CatalogEntry = { title: string; sector: string };

/** Search vocabulary only. It is never presented as job availability. */
const sector = (name: string, titles: string[]): CatalogEntry[] => titles.map((title) => ({ title, sector: name }));

const JOB_TITLE_CATALOG: CatalogEntry[] = [
  ...sector("Finance & Accounting", ["Accountant","Accounting Analyst","Accounting Assistant","Accounting Associate","Accounting Clerk","Accounting Manager","Accounts Payable Specialist","Accounts Receivable Specialist","Auditor","Bookkeeper","Controller","Finance Analyst","Financial Analyst","Financial Controller","Tax Accountant","Tax Analyst","Investment Analyst","Financial Advisor","Loan Officer","Mortgage Advisor"]),
  ...sector("Business & Operations", ["Administrative Assistant","Administrative Coordinator","Office Administrator","Office Assistant","Executive Assistant","Operations Assistant","Operations Coordinator","Operations Manager","Project Coordinator","Project Manager","Program Manager","Program Coordinator","Business Analyst","Business Development Manager","Business Development Representative","Management Analyst","Product Manager","Product Owner","Product Analyst","Strategy Analyst","Management Consultant","Business Consultant"]),
  ...sector("Technology & IT", ["Software Engineer","Software Developer","Full Stack Developer","Frontend Developer","Backend Developer","Web Developer","Mobile Developer","React Developer","Next.js Developer","JavaScript Developer","TypeScript Developer","Python Developer","Rust Developer","DevOps Engineer","Cloud Engineer","Site Reliability Engineer","Data Engineer","Data Analyst","Data Scientist","Machine Learning Engineer","AI Engineer","Cybersecurity Analyst","Cybersecurity Engineer","Security Engineer","QA Engineer","QA Tester","Test Engineer","Systems Administrator","Network Engineer","Database Administrator","Solutions Architect","Software Architect","Technical Support Specialist","IT Support Specialist","IT Manager"]),
  ...sector("Design & Creative", ["UI Designer","UX Designer","Product Designer","Graphic Designer","Web Designer","Visual Designer","Brand Designer","Creative Director","Art Director","Content Designer","Motion Designer","Animator","Illustrator","Photographer","Videographer","Video Editor","Copywriter","Technical Writer","Content Writer","Content Creator","Editor"]),
  ...sector("Marketing & Communications", ["Marketing Manager","Marketing Coordinator","Digital Marketing Specialist","Digital Marketing Manager","SEO Specialist","SEO Manager","Social Media Manager","Social Media Specialist","Growth Manager","Growth Marketer","Brand Manager","Communications Manager","Public Relations Specialist","Market Research Analyst","Email Marketing Specialist","Performance Marketing Specialist","Media Buyer","Advertising Specialist","Publicist"]),
  ...sector("Sales & Customer Success", ["Sales Manager","Sales Representative","Sales Associate","Sales Development Representative","Account Executive","Account Manager","Customer Success Manager","Customer Success Specialist","Customer Support Specialist","Customer Service Representative","Customer Service Agent","Call Center Representative","Sales Engineer","Retail Sales Consultant"]),
  ...sector("Human Resources", ["Human Resources Manager","HR Manager","HR Generalist","HR Specialist","Recruiter","Technical Recruiter","Talent Acquisition Specialist","Talent Acquisition Manager","People Operations Manager","Training Coordinator","Learning and Development Specialist","Payroll Specialist"]),
  ...sector("Legal & Compliance", ["Lawyer","Attorney","Legal Assistant","Legal Counsel","Paralegal","Compliance Analyst","Compliance Manager","Risk Analyst","Risk Manager","Contract Specialist","Legal Secretary"]),
  ...sector("Education", ["Teacher","Teaching Assistant","Tutor","Lecturer","Professor","Instructional Designer","Academic Advisor","School Administrator","Principal","Counselor","Special Education Teacher","School Teacher","Early Childhood Teacher","Curriculum Developer"]),
  ...sector("Healthcare & Medicine", ["Nurse","Registered Nurse","Nursing Assistant","Medical Assistant","Medical Receptionist","Pharmacist","Pharmacy Technician","Medical Laboratory Scientist","Lab Technician","Radiologic Technologist","Physical Therapist","Occupational Therapist","Dental Assistant","Dental Hygienist","Healthcare Administrator","Healthcare Manager","Doctor","Physician","Surgeon","Medical Doctor","Dentist","Optometrist","Veterinarian","Veterinary Assistant","Paramedic","Emergency Medical Technician","Caregiver","Mental Health Counselor","Psychologist","Nutritionist","Dietitian"]),
  ...sector("Pharmaceuticals & Biotechnology", ["Pharmaceutical Scientist","Clinical Research Associate","Clinical Research Coordinator","Regulatory Affairs Specialist","Quality Control Analyst","Quality Assurance Specialist","Biochemist","Microbiologist","Biotechnologist","Pharmacovigilance Specialist","Medical Science Liaison"]),
  ...sector("Science & Research", ["Research Scientist","Research Assistant","Laboratory Scientist","Chemist","Physicist","Biologist","Geologist","Environmental Scientist","Research Analyst","Research Associate","Scientific Writer","Lab Manager"]),
  ...sector("Agriculture & Agribusiness", ["Farmer","Farm Manager","Agricultural Engineer","Agronomist","Agricultural Scientist","Agricultural Technician","Horticulturist","Agricultural Economist","Farm Worker","Livestock Manager","Poultry Farmer","Crop Manager","Fisheries Officer","Fisherman","Forestry Technician","Forester"]),
  ...sector("Energy & Utilities", ["Energy Engineer","Petroleum Engineer","Petroleum Geologist","Oil and Gas Engineer","Drilling Engineer","Reservoir Engineer","Renewable Energy Engineer","Solar Technician","Solar Installer","Wind Energy Technician","Power Plant Operator","Electrical Technician","Utility Technician","Energy Analyst","Utilities Manager"]),
  ...sector("Mining & Natural Resources", ["Mining Engineer","Mining Geologist","Mine Manager","Mining Technician","Geologist","Metallurgist","Drilling Technician","Quarry Manager","Quarry Worker","Environmental Officer"]),
  ...sector("Manufacturing & Industrial", ["Manufacturing Engineer","Production Engineer","Production Manager","Factory Manager","Plant Manager","Process Engineer","Industrial Technician","Machine Operator","CNC Operator","Assembly Worker","Quality Inspector","Quality Engineer","Production Supervisor","Operations Technician"]),
  ...sector("Automotive & Mobility", ["Automotive Engineer","Automotive Technician","Auto Mechanic","Vehicle Inspector","Service Advisor","Auto Electrician","Body Repair Technician","Motorcycle Mechanic","Fleet Manager","Fleet Coordinator","Driving Instructor"]),
  ...sector("Aviation & Aerospace", ["Pilot","Commercial Pilot","Flight Instructor","Flight Attendant","Cabin Crew","Aircraft Engineer","Aerospace Engineer","Aircraft Maintenance Technician","Avionics Technician","Airport Manager","Airport Operations Officer","Air Traffic Controller","Ground Operations Agent","Baggage Handler"]),
  ...sector("Maritime & Marine", ["Marine Engineer","Marine Surveyor","Ship Captain","Deck Officer","Marine Technician","Ship Mechanic","Port Manager","Port Operations Officer","Seafarer","Fisheries Officer","Boat Operator"]),
  ...sector("Telecommunications", ["Telecommunications Engineer","Telecom Technician","Network Technician","Fiber Optic Technician","RF Engineer","Radio Technician","Telecom Project Manager","Network Operations Engineer","Field Service Technician"]),
  ...sector("Construction & Skilled Trades", ["Construction Manager","Construction Worker","Electrician","Plumber","Carpenter","Welder","Mason","Bricklayer","Roofer","Painter","Glazier","Tiler","Mechanic","Automotive Technician","Maintenance Technician","Maintenance Manager","Surveyor","Heavy Equipment Operator","Crane Operator","HVAC Technician"]),
  ...sector("Engineering & Architecture", ["Civil Engineer","Mechanical Engineer","Electrical Engineer","Chemical Engineer","Industrial Engineer","Project Engineer","Site Engineer","Architect","Landscape Architect","Structural Engineer","Environmental Engineer","Biomedical Engineer","Materials Engineer","Mechatronics Engineer","Engineering Technician"]),
  ...sector("Real Estate & Property", ["Real Estate Agent","Real Estate Broker","Property Manager","Leasing Consultant","Property Administrator","Facilities Manager","Facilities Coordinator","Real Estate Analyst","Valuation Analyst","Building Manager"]),
  ...sector("Insurance & Banking", ["Insurance Agent","Insurance Analyst","Underwriter","Claims Adjuster","Actuary","Bank Teller","Bank Manager","Loan Officer","Credit Analyst","Mortgage Advisor","Branch Manager","Relationship Manager"]),
  ...sector("Retail & E-commerce", ["Retail Associate","Retail Manager","Store Manager","Store Supervisor","Merchandiser","Visual Merchandiser","E-commerce Manager","E-commerce Specialist","Buyer","Purchasing Agent","Cashier","Sales Clerk"]),
  ...sector("Logistics & Supply Chain", ["Warehouse Associate","Warehouse Manager","Inventory Specialist","Logistics Coordinator","Logistics Manager","Supply Chain Analyst","Supply Chain Manager","Procurement Specialist","Procurement Manager","Purchasing Manager","Dispatcher","Delivery Driver","Truck Driver","Driver","Courier","Fleet Coordinator"]),
  ...sector("Hospitality & Tourism", ["Chef","Sous Chef","Cook","Baker","Pastry Chef","Restaurant Manager","Restaurant Supervisor","Bartender","Server","Waiter","Waitress","Barista","Catering Manager","Hotel Manager","Front Desk Agent","Housekeeper","Event Coordinator","Event Manager","Tour Guide","Travel Agent","Travel Consultant"]),
  ...sector("Food & Beverage Production", ["Food Scientist","Food Technologist","Food Production Manager","Food Safety Officer","Quality Control Technician","Butcher","Brewery Technician","Production Worker","Bakery Manager","Catering Assistant"]),
  ...sector("Fashion & Beauty", ["Fashion Designer","Fashion Stylist","Fashion Buyer","Fashion Merchandiser","Tailor","Seamstress","Pattern Maker","Makeup Artist","Hair Stylist","Barber","Beautician","Nail Technician","Spa Therapist","Esthetician"]),
  ...sector("Arts & Entertainment", ["Dancer","Professional Dancer","Dance Instructor","Dance Teacher","Choreographer","Ballet Dancer","Contemporary Dancer","Hip Hop Dancer","Dance Coach","Performing Artist","Actor","Actress","Singer","Musician","Music Teacher","Theater Director","Stage Manager","Producer","Casting Director","Talent Manager"]),
  ...sector("Sports & Fitness", ["Athlete","Sports Coach","Fitness Trainer","Personal Trainer","Sports Manager","Sports Analyst","Referee","Sports Therapist","Physiotherapist","Gym Instructor","Yoga Instructor","Swimming Instructor","Football Coach","Athletics Coach"]),
  ...sector("Media & Publishing", ["Journalist","Reporter","News Editor","Managing Editor","News Producer","Broadcast Producer","Radio Presenter","Television Presenter","News Anchor","Correspondent","Publisher","Proofreader","Editorial Assistant","Researcher"]),
  ...sector("Government & Public Service", ["Civil Servant","Public Administrator","Policy Analyst","Government Relations Officer","Public Affairs Specialist","Municipal Officer","Diplomatic Officer","Foreign Service Officer","Customs Officer","Immigration Officer","Tax Officer","Public Health Officer","Community Development Officer"]),
  ...sector("Security & Emergency Services", ["Security Guard","Security Officer","Security Manager","Security Supervisor","Police Officer","Firefighter","Fire Safety Officer","Emergency Dispatcher","Private Investigator","Loss Prevention Officer","Safety Officer","Occupational Health and Safety Specialist"]),
  ...sector("Environmental & Sustainability", ["Environmental Consultant","Environmental Officer","Sustainability Manager","Sustainability Analyst","Climate Scientist","Conservation Officer","Ecologist","Waste Management Officer","Recycling Coordinator","Water Quality Specialist","Environmental Health Officer"]),
  ...sector("Social & Community Services", ["Social Worker","Community Manager","Community Development Officer","Youth Worker","Case Worker","Family Support Worker","Counselor","Outreach Coordinator","Nonprofit Program Manager","Fundraising Manager","Volunteer Coordinator"]),
  ...sector("Government & Defense", ["Military Officer","Defense Analyst","Defense Contractor","Intelligence Analyst","Logistics Officer","Procurement Officer","Public Safety Officer"]),
];

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function scoreTitle(title: string, query: string) {
  const normalizedTitle = normalize(title), normalizedQuery = normalize(query);
  if (!normalizedTitle || !normalizedQuery) return 0;
  if (normalizedTitle === normalizedQuery) return 1000;
  if (normalizedTitle.startsWith(normalizedQuery)) return 900;
  if (normalizedTitle.includes(` ${normalizedQuery}`) || normalizedTitle.includes(`${normalizedQuery} `)) return 800;
  if (normalizedTitle.includes(normalizedQuery)) return 700;
  const queryTokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
  const titleTokens = new Set(normalizedTitle.split(" "));
  const hits = queryTokens.filter((token) => titleTokens.has(token)).length;
  return hits ? 500 + Math.round((hits / queryTokens.length) * 250) : 0;
}
function matchCatalog(query: string) { return JOB_TITLE_CATALOG.map((entry) => ({ ...entry, score: scoreTitle(entry.title, query) })).filter((entry) => entry.score > 0).sort((a,b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 8); }
async function learnedTitles(query: string, userId: string, organizationId?: string | null) {
  try {
    const db = getDb();
    const where = sql`owner_id = ${userId} AND (${organizationId ?? null} IS NULL OR organization_id = ${organizationId ?? null})`;
    const result = await db.execute(sql`SELECT title, COUNT(*)::int AS frequency FROM jobs WHERE ${where} AND title IS NOT NULL AND LENGTH(TRIM(title)) BETWEEN 2 AND 100 GROUP BY title ORDER BY frequency DESC, title ASC LIMIT 100`);
    return result.rows.map((row) => ({ title: String((row as { title?: unknown }).title ?? "").trim(), frequency: Number((row as { frequency?: unknown }).frequency ?? 0) })).filter((row) => row.title && scoreTitle(row.title, query) > 0).sort((a,b) => scoreTitle(b.title, query) - scoreTitle(a.title, query) || b.frequency - a.frequency).slice(0, 8);
  } catch { return []; }
}
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ suggestions: [] });
  const catalog = matchCatalog(query);
  const learned = await learnedTitles(query, auth.userId, auth.organizationId);
  const seen = new Set<string>();
  const suggestions = [...learned.map((entry) => ({ title: entry.title, sector: "Learned from your job data" })), ...catalog].filter((entry) => { const key = normalize(entry.title); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 8);
  return NextResponse.json({ suggestions, source: learned.length ? "code+learned" : "code", sectors: [...new Set(suggestions.map((entry) => entry.sector))] });
}
