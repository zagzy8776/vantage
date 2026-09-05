import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAuth } from "@/auth/middleware";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type CatalogEntry = { title: string; sector: string };

/** Search vocabulary only. It is never presented as job availability. */
const JOB_TITLE_CATALOG: CatalogEntry[] = [
  ...[
    "Accountant", "Accounting Analyst", "Accounting Assistant", "Accounting Associate", "Accounting Clerk", "Accounting Manager", "Accounts Payable Specialist", "Accounts Receivable Specialist", "Auditor", "Bookkeeper", "Controller", "Finance Analyst", "Financial Analyst", "Financial Controller", "Tax Accountant", "Tax Analyst"
  ].map((title) => ({ title, sector: "Finance & Accounting" })),
  ...[
    "Administrative Assistant", "Administrative Coordinator", "Office Administrator", "Office Assistant", "Executive Assistant", "Operations Assistant", "Operations Coordinator", "Operations Manager", "Project Coordinator", "Project Manager", "Program Manager", "Program Coordinator", "Business Analyst", "Business Development Manager", "Business Development Representative", "Management Analyst", "Product Manager", "Product Owner", "Product Analyst", "Strategy Analyst"
  ].map((title) => ({ title, sector: "Business & Operations" })),
  ...[
    "Software Engineer", "Software Developer", "Full Stack Developer", "Frontend Developer", "Backend Developer", "Web Developer", "Mobile Developer", "React Developer", "Next.js Developer", "JavaScript Developer", "TypeScript Developer", "Python Developer", "Rust Developer", "DevOps Engineer", "Cloud Engineer", "Site Reliability Engineer", "Data Engineer", "Data Analyst", "Data Scientist", "Machine Learning Engineer", "AI Engineer", "Cybersecurity Analyst", "Cybersecurity Engineer", "Security Engineer", "QA Engineer", "QA Tester", "Test Engineer", "Systems Administrator", "Network Engineer", "Database Administrator", "Solutions Architect", "Software Architect", "Technical Support Specialist", "IT Support Specialist", "IT Manager"
  ].map((title) => ({ title, sector: "Technology & IT" })),
  ...[
    "UI Designer", "UX Designer", "Product Designer", "Graphic Designer", "Web Designer", "Visual Designer", "Brand Designer", "Creative Director", "Art Director", "Content Designer", "Motion Designer", "Animator", "Illustrator", "Photographer", "Videographer", "Video Editor", "Copywriter", "Technical Writer", "Content Writer", "Content Creator", "Editor"
  ].map((title) => ({ title, sector: "Design & Creative" })),
  ...[
    "Marketing Manager", "Marketing Coordinator", "Digital Marketing Specialist", "Digital Marketing Manager", "SEO Specialist", "SEO Manager", "Social Media Manager", "Social Media Specialist", "Growth Manager", "Growth Marketer", "Brand Manager", "Communications Manager", "Public Relations Specialist", "Market Research Analyst", "Email Marketing Specialist", "Performance Marketing Specialist"
  ].map((title) => ({ title, sector: "Marketing & Communications" })),
  ...[
    "Sales Manager", "Sales Representative", "Sales Associate", "Sales Development Representative", "Account Executive", "Account Manager", "Customer Success Manager", "Customer Success Specialist", "Customer Support Specialist", "Customer Service Representative", "Customer Service Agent", "Call Center Representative"
  ].map((title) => ({ title, sector: "Sales & Customer Success" })),
  ...[
    "Human Resources Manager", "HR Manager", "HR Generalist", "HR Specialist", "Recruiter", "Technical Recruiter", "Talent Acquisition Specialist", "Talent Acquisition Manager", "People Operations Manager", "Training Coordinator", "Learning and Development Specialist", "Payroll Specialist"
  ].map((title) => ({ title, sector: "Human Resources" })),
  ...[
    "Lawyer", "Legal Assistant", "Legal Counsel", "Paralegal", "Compliance Analyst", "Compliance Manager", "Risk Analyst", "Risk Manager"
  ].map((title) => ({ title, sector: "Legal & Compliance" })),
  ...[
    "Teacher", "Teaching Assistant", "Tutor", "Lecturer", "Professor", "Instructional Designer", "Academic Advisor", "School Administrator", "Principal", "Counselor"
  ].map((title) => ({ title, sector: "Education" })),
  ...[
    "Nurse", "Registered Nurse", "Nursing Assistant", "Medical Assistant", "Medical Receptionist", "Pharmacist", "Pharmacy Technician", "Medical Laboratory Scientist", "Lab Technician", "Radiologic Technologist", "Physical Therapist", "Occupational Therapist", "Dental Assistant", "Dental Hygienist", "Healthcare Administrator", "Healthcare Manager"
  ].map((title) => ({ title, sector: "Healthcare" })),
  ...[
    "Dancer", "Professional Dancer", "Dance Instructor", "Dance Teacher", "Choreographer", "Ballet Dancer", "Contemporary Dancer", "Hip Hop Dancer", "Dance Coach", "Dance Studio Instructor", "Performing Artist", "Actor", "Actress", "Singer", "Musician", "Music Teacher", "Theater Director", "Stage Manager"
  ].map((title) => ({ title, sector: "Arts & Entertainment" })),
  ...[
    "Chef", "Sous Chef", "Cook", "Baker", "Pastry Chef", "Restaurant Manager", "Restaurant Supervisor", "Bartender", "Server", "Waiter", "Waitress", "Barista", "Catering Manager", "Hotel Manager", "Front Desk Agent", "Housekeeper", "Event Coordinator", "Event Manager"
  ].map((title) => ({ title, sector: "Hospitality & Tourism" })),
  ...[
    "Retail Associate", "Retail Manager", "Store Manager", "Store Supervisor", "Merchandiser", "Warehouse Associate", "Warehouse Manager", "Inventory Specialist", "Logistics Coordinator", "Logistics Manager", "Supply Chain Analyst", "Supply Chain Manager", "Procurement Specialist", "Procurement Manager", "Purchasing Agent", "Driver", "Delivery Driver", "Truck Driver", "Dispatcher"
  ].map((title) => ({ title, sector: "Retail & Supply Chain" })),
  ...[
    "Construction Manager", "Construction Worker", "Electrician", "Plumber", "Carpenter", "Welder", "Mechanic", "Automotive Technician", "Maintenance Technician", "Maintenance Manager", "Civil Engineer", "Mechanical Engineer", "Electrical Engineer", "Chemical Engineer", "Industrial Engineer", "Project Engineer", "Site Engineer", "Architect", "Surveyor"
  ].map((title) => ({ title, sector: "Construction & Engineering" })),
  ...[
    "Real Estate Agent", "Property Manager", "Leasing Consultant", "Insurance Agent", "Insurance Analyst", "Bank Teller", "Loan Officer", "Mortgage Advisor", "Investment Analyst", "Financial Advisor", "Security Guard", "Security Officer", "Social Worker", "Community Manager", "Nonprofit Program Manager", "Personal Assistant", "Receptionist"
  ].map((title) => ({ title, sector: "Other Professional Services" })),
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function scoreTitle(title: string, query: string) {
  const normalizedTitle = normalize(title);
  const normalizedQuery = normalize(query);
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

function matchCatalog(query: string) {
  return JOB_TITLE_CATALOG
    .map((entry) => ({ ...entry, score: scoreTitle(entry.title, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 8);
}

async function learnedTitles(query: string, userId: string, organizationId?: string | null) {
  try {
    const db = getDb();
    const where = sql`owner_id = ${userId} AND (${organizationId ?? null} IS NULL OR organization_id = ${organizationId ?? null})`;
    const result = await db.execute(sql`SELECT title, COUNT(*)::int AS frequency FROM jobs WHERE ${where} AND title IS NOT NULL AND LENGTH(TRIM(title)) BETWEEN 2 AND 100 GROUP BY title ORDER BY frequency DESC, title ASC LIMIT 100`);
    return result.rows
      .map((row) => ({ title: String((row as { title?: unknown }).title ?? "").trim(), frequency: Number((row as { frequency?: unknown }).frequency ?? 0) }))
      .filter((row) => row.title && scoreTitle(row.title, query) > 0)
      .sort((a, b) => scoreTitle(b.title, query) - scoreTitle(a.title, query) || b.frequency - a.frequency)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  const catalog = matchCatalog(query);
  const learned = await learnedTitles(query, auth.userId, auth.organizationId);
  const seen = new Set<string>();
  const suggestions = [...learned.map((entry) => ({ title: entry.title, sector: "Learned from your job data" })), ...catalog]
    .filter((entry) => {
      const key = normalize(entry.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);

  return NextResponse.json({
    suggestions,
    source: learned.length ? "code+learned" : "code",
    sectors: [...new Set(suggestions.map((entry) => entry.sector))],
  });
}
