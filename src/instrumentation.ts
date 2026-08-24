export async function register() {
  // VANTAGE recovery is driven by the external cron endpoint
  // (/api/system/sweep) on serverless deployments. Do not start an
  // in-process interval here: importing the recovery coordinator from
  // instrumentation pulls Workflow's Node-only runtime into Next.js's
  // application bundle and breaks the production build.
}
