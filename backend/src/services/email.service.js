// ============================================================
// EMAIL SERVICE
// Thin wrapper around Resend so the rest of the app never
// touches the API directly. If RESEND_API_KEY isn't set (e.g.
// local dev without a key yet), emails are logged to the
// console instead of failing the whole request.
// ============================================================

const { Resend } = require("resend");

let resendClient = null;
function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

/**
 * @param {{to:string, subject:string, html:string, cc?:string}} msg
 */
async function sendEmail(msg) {
  if (!msg.to) {
    console.warn("[email] skipped - no recipient address", msg.subject);
    return { skipped: true };
  }

  const client = getClient();
  if (!client) {
    console.log("[email:DEV MODE - no RESEND_API_KEY set] Would send:", msg.subject, "->", msg.to);
    return { devMode: true };
  }

  try {
    const result = await client.emails.send({
      from: process.env.ALERT_FROM_EMAIL || "onboarding@resend.dev",
      to: msg.to,
      cc: msg.cc || undefined,
      subject: msg.subject,
      html: msg.html,
    });
    return result;
  } catch (err) {
    console.error("[email] send failed:", err.message);
    return { error: err.message };
  }
}

module.exports = { sendEmail };
