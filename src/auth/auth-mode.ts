/** Temporary pre-domain authentication mode.
 *
 * VANTAGE can run without a verified sending domain while the product is being
 * tested. Enable this explicitly with VANTAGE_AUTH_TEMPORARY_MODE=true.
 * In this mode signup activates the account immediately and sign-in does not
 * require email verification. Set it to false once VANTAGE email delivery is
 * live.
 */
export function isTemporaryAuthModeEnabled(): boolean {
  return process.env.VANTAGE_AUTH_TEMPORARY_MODE === "true";
}
