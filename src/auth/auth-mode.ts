/**
 * Temporary pre-domain authentication mode.
 *
 * VANTAGE is currently running before a verified sending domain exists, so
 * account creation/sign-in must not depend on Resend. Temporary auth stays on
 * unless the deployment explicitly declares that the email domain is ready.
 *
 * To switch to real email verification later, set BOTH:
 *   VANTAGE_DOMAIN_READY=true
 *   VANTAGE_AUTH_TEMPORARY_MODE=false
 */
export function isTemporaryAuthModeEnabled(): boolean {
  const domainReady = process.env.VANTAGE_DOMAIN_READY === "true";
  const explicitlyDisabled = process.env.VANTAGE_AUTH_TEMPORARY_MODE === "false";
  return !(domainReady && explicitlyDisabled);
}
