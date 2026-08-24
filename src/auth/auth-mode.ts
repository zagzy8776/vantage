/**
 * Temporary pre-domain authentication mode.
 *
 * VANTAGE can run without a verified sending domain while the product is being
 * tested. During this pre-domain period we default to temporary auth unless
 * VANTAGE_AUTH_TEMPORARY_MODE is explicitly set to "false". That keeps a
 * newly-created deployment usable even when the environment variable is
 * missing. Once VANTAGE email delivery is live, set the variable to "false" to
 * turn real email verification back on.
 */
export function isTemporaryAuthModeEnabled(): boolean {
  return process.env.VANTAGE_AUTH_TEMPORARY_MODE !== "false";
}
