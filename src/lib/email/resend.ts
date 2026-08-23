/**
 * Transactional email via the Resend HTTP API.
 *
 * Uses plain fetch - no SDK dependency. The API key lives in RESEND_API_KEY
 * (server-side only) and is NEVER returned or logged. Verification codes are
 * passed in by the caller and are never logged here either.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendResult {
  /** true when Resend accepted the message */
  sent: boolean;
  /** false when RESEND_API_KEY is not configured */
  configured: boolean;
  /** safe, user-facing failure description (no keys, no codes) */
  reason?: string;
}

export function isEmailProviderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function buildHtml(code: string): string {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#0d0f14;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#151821;border:1px solid #2a2f3d;border-radius:12px;padding:32px;text-align:center;">
      <p style="color:#e6b64c;font-weight:bold;letter-spacing:4px;margin:0 0 16px;">VANTAGE</p>
      <h1 style="color:#f5f6fa;font-size:18px;margin:0 0 8px;">Verify your VANTAGE account</h1>
      <p style="color:#9aa1b2;font-size:13px;margin:0 0 24px;">
        Your VANTAGE verification code:
      </p>
      <div style="font-size:34px;font-weight:bold;color:#e6b64c;letter-spacing:10px;font-family:monospace;margin:0 0 24px;">
        ${code}
      </div>
      <p style="color:#9aa1b2;font-size:12px;margin:0;">
        This code expires in <strong style="color:#f5f6fa;">10 minutes</strong>.
        If you did not request it, you can safely ignore this email.
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Send a verification code email through Resend.
 * Never logs or returns the code or API credentials.
 */
export async function sendVerificationEmail(
  toEmail: string,
  code: string
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, configured: false, reason: "Email provider not configured." };
  }

  const from = process.env.EMAIL_FROM?.trim() || "VANTAGE <onboarding@resend.dev>";

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: "Verify your VANTAGE account",
        text: `Your VANTAGE verification code:\n\n${code}\n\nThis code expires in 10 minutes.`,
        html: buildHtml(code),
      }),
    });

    if (!response.ok) {
      // Log only status - response body could echo addresses/content.
      console.error(`Verification email rejected by provider (status ${response.status}).`);
      return {
        sent: false,
        configured: true,
        reason: "We could not send the verification email right now. Please try again.",
      };
    }

    return { sent: true, configured: true };
  } catch {
    console.error("Verification email request failed (network error).");
    return {
      sent: false,
      configured: true,
      reason: "We could not send the verification email right now. Please try again.",
    };
  }
}
