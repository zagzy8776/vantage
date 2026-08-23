export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { startExecutionSweeper } = await import("@/services/investigations/planning/execution/sweeper");
    startExecutionSweeper();
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "execution_sweeper_start_failed", message: error instanceof Error ? error.message : String(error) }));
  }
}
