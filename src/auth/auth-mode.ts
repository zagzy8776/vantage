/**
 * Temporary pre-domain authentication mode.
 *
 * VANTAGE does not have its own verified sending domain yet. Until the owner
 * explicitly turns on live email verification, signup and signin must never
 * depend on Resend or a verification code.
 *
 * IMPORTANT: deployment environment variables must not accidentally switch
 * customer authentication into email-verification mode. Live verification is
 * therefore opt-in via one explicit flag only:
 *
 *   VANTAGE_EMAIL_VERIFICATION_LIVE=true
 *
 * When the VANTAGE sending domain is eventually verified, enable that flag.
 */
export function isTemporaryAuthModeEnabled(): boolean {
  return process.env.VANTAGE_EMAIL_VERIFICATION_LIVE !== "true";
}
