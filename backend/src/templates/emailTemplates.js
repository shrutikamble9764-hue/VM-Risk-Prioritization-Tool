// ============================================================
// EMAIL TEMPLATES
// Every automated email the platform sends is defined here in
// one place, so tone/content is easy to review and edit.
// Each function returns { to, subject, html } ready for email.service.js
// ============================================================

/**
 * Escapes HTML special characters. MUST be applied to any value that
 * originated from user input (finding title/description/remediation advice,
 * asset hostnames, CVE IDs, etc.) before it's inserted into an email's HTML
 * body - otherwise a malicious finding title like `<script>...</script>`
 * or `<img onerror=...>` submitted via the "Add Finding" form or a bulk
 * CSV import would be injected directly into the email as live HTML.
 */
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
}

function baseWrap(title, bodyHtml, urgencyColor = "#1f2937") {
  return `
  <div style="font-family: Arial, sans-serif; max-width:640px; margin:auto; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
    <div style="background:${urgencyColor}; color:#fff; padding:16px 24px;">
      <h2 style="margin:0; font-size:18px;">${title}</h2>
    </div>
    <div style="padding:24px; color:#111827; font-size:14px; line-height:1.6;">
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px; background:#f9fafb; color:#6b7280; font-size:12px;">
      This is an automated message from your Vulnerability Management Platform.
    </div>
  </div>`;
}

function findingSummaryBlock(finding, asset) {
  return `
    <table style="width:100%; border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 0; color:#6b7280;">CVE</td><td style="padding:4px 0; font-weight:bold;">${esc(finding.cveId) || "N/A"}</td></tr>
      <tr><td style="padding:4px 0; color:#6b7280;">Asset</td><td style="padding:4px 0;">${esc(asset.hostname)} (${esc(asset.ip) || "no IP"})</td></tr>
      <tr><td style="padding:4px 0; color:#6b7280;">Severity</td><td style="padding:4px 0; font-weight:bold;">${esc(finding.severity)}</td></tr>
      <tr><td style="padding:4px 0; color:#6b7280;">Risk Score</td><td style="padding:4px 0; font-weight:bold;">${finding.riskScore}/10</td></tr>
      <tr><td style="padding:4px 0; color:#6b7280;">SLA Deadline</td><td style="padding:4px 0;">${fmtDate(finding.slaDeadline)}</td></tr>
    </table>`;
}

function newFindingEmail(finding, asset) {
  return {
    to: asset.owner?.email,
    subject: `[New Finding] ${finding.severity} - ${finding.cveId || finding.title} on ${asset.hostname}`,
    html: baseWrap(
      "New Vulnerability Assigned To You",
      `<p>A new vulnerability has been identified on an asset you own.</p>
       ${findingSummaryBlock(finding, asset)}
       <p><strong>Business impact:</strong> ${esc(businessImpactPlainLanguage(finding, asset))}</p>
       <p><strong>Recommended fix:</strong> ${esc(finding.remediationAdvice) || "See ticket for remediation guidance."}</p>
       <p>Please review and remediate before the SLA deadline. A ticket has been created and linked to this finding.</p>`,
      "#b91c1c"
    ),
  };
}

function reminderEmail(finding, asset, percent) {
  const urgency = percent >= 90 ? "#b91c1c" : percent >= 75 ? "#c2410c" : "#a16207";
  const tone =
    percent >= 90
      ? "This is urgent - the SLA deadline is almost here."
      : percent >= 75
      ? "Time is running short on this one."
      : "Just a friendly reminder to keep this on track.";
  return {
    to: asset.owner?.email,
    subject: `[Reminder ${percent}% of SLA used] ${finding.cveId || finding.title} on ${asset.hostname}`,
    html: baseWrap(
      `SLA Reminder - ${percent}% Elapsed`,
      `<p>${tone}</p>
       ${findingSummaryBlock(finding, asset)}
       <p><strong>Current status:</strong> ${finding.status}</p>`,
      urgency
    ),
  };
}

function escalationEmail(finding, asset) {
  return {
    to: process.env.CISO_ESCALATION_EMAIL,
    cc: asset.owner?.email,
    subject: `[SLA BREACHED] ${finding.severity} - ${finding.cveId || finding.title} unresolved on ${asset.hostname}`,
    html: baseWrap(
      "SLA Breach - Escalation",
      `<p>The following finding has breached its SLA and remains unresolved.</p>
       ${findingSummaryBlock(finding, asset)}
       <p><strong>Owner:</strong> ${esc(asset.owner?.name) || "Unassigned"} (${esc(asset.owner?.email) || "N/A"})</p>
       <p><strong>First detected:</strong> ${fmtDate(finding.firstDetectedAt)}</p>
       <p><strong>Reminders already sent:</strong> ${[
         finding.reminder50Sent && "50%",
         finding.reminder75Sent && "75%",
         finding.reminder90Sent && "90%",
       ]
         .filter(Boolean)
         .join(", ") || "none"}</p>
       <p>No action was taken within the SLA window. Please follow up directly with the owning team.</p>`,
      "#7f1d1d"
    ),
  };
}

function newlyKevEmail(finding, asset) {
  return {
    to: asset.owner?.email,
    subject: `[URGENT - Active Exploitation] ${finding.cveId} on ${asset.hostname} just entered CISA KEV`,
    html: baseWrap(
      "Vulnerability Now Actively Exploited In The Wild",
      `<p>${finding.cveId} affecting your asset was just added to the CISA Known Exploited Vulnerabilities catalog. This means it is being actively exploited by attackers right now, not just theoretically risky.</p>
       ${findingSummaryBlock(finding, asset)}
       <p>This finding's risk score and SLA priority have been automatically updated. Please treat this as top priority regardless of the original deadline.</p>`,
      "#7f1d1d"
    ),
  };
}

function verifiedClosedEmail(finding, asset) {
  return {
    to: asset.owner?.email,
    subject: `[Verified & Closed] ${finding.cveId || finding.title} on ${asset.hostname}`,
    html: baseWrap(
      "Fix Verified - Finding Closed",
      `<p>Good news - the rescan confirmed this vulnerability is no longer present. The ticket has been closed automatically.</p>
       ${findingSummaryBlock(finding, asset)}`,
      "#166534"
    ),
  };
}

function reopenedEmail(finding, asset) {
  return {
    to: asset.owner?.email,
    subject: `[Reopened - Fix Not Confirmed] ${finding.cveId || finding.title} on ${asset.hostname}`,
    html: baseWrap(
      "Rescan Failed - Ticket Reopened",
      `<p>The finding was marked as fixed, but the verification rescan shows it is still present. The ticket has been reopened and the SLA clock continues.</p>
       ${findingSummaryBlock(finding, asset)}`,
      "#b45309"
    ),
  };
}

function businessImpactPlainLanguage(finding, asset) {
  const parts = [];
  if (asset.internetFacing) parts.push("this system is internet-facing, so it can be reached by anyone on the internet");
  if (asset.dataSensitive) parts.push("it handles sensitive/compliance-relevant data");
  if (asset.criticality === "CRITICAL" || asset.criticality === "HIGH")
    parts.push(`it is tagged as ${asset.criticality.toLowerCase()} business criticality`);
  if (finding.inKev) parts.push("this exact vulnerability is being actively exploited by attackers right now");
  if (!parts.length) return "Standard risk - no elevated exposure factors detected.";
  return "This matters because " + parts.join(", ") + ".";
}

module.exports = {
  newFindingEmail,
  reminderEmail,
  escalationEmail,
  newlyKevEmail,
  verifiedClosedEmail,
  reopenedEmail,
};
