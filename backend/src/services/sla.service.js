// ============================================================
// SLA AUTOMATION ENGINE
// This is what fixes the "SLA lives in a PDF" problem.
// Runs daily: for every OPEN finding, checks how much of its
// SLA window has elapsed and fires the right email:
//   50% elapsed  -> gentle reminder
//   75% elapsed  -> urgent reminder
//   90% elapsed  -> final warning
//   100%+ (breached) -> escalation to CISO/manager, cc owner
// Each email is sent only ONCE per finding (tracked via booleans)
// so people don't get spammed.
// ============================================================

const prisma = require("../config/db");
const { sendEmail } = require("./email.service");
const { reminderEmail, escalationEmail } = require("../templates/emailTemplates");

const OPEN_STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS", "RESCAN_PENDING"];

async function runSlaCheck() {
  const now = new Date();

  const openFindings = await prisma.finding.findMany({
    where: { status: { in: OPEN_STATUSES }, slaDeadline: { not: null } },
    include: { asset: { include: { owner: true } } },
  });

  let sent = { reminder50: 0, reminder75: 0, reminder90: 0, escalation: 0 };

  for (const finding of openFindings) {
    const totalWindowMs =
      finding.slaDeadline.getTime() - finding.firstDetectedAt.getTime();
    const elapsedMs = now.getTime() - finding.firstDetectedAt.getTime();
    const percentElapsed = totalWindowMs > 0 ? (elapsedMs / totalWindowMs) * 100 : 100;

    const updates = {};

    if (percentElapsed >= 100) {
      // SLA breached
      if (!finding.escalationSent) {
        await sendEmail(escalationEmail(finding, finding.asset));
        updates.escalationSent = true;
        sent.escalation++;
      }
    } else if (percentElapsed >= 90) {
      if (!finding.reminder90Sent) {
        await sendEmail(reminderEmail(finding, finding.asset, 90));
        updates.reminder90Sent = true;
        sent.reminder90++;
      }
    } else if (percentElapsed >= 75) {
      if (!finding.reminder75Sent) {
        await sendEmail(reminderEmail(finding, finding.asset, 75));
        updates.reminder75Sent = true;
        sent.reminder75++;
      }
    } else if (percentElapsed >= 50) {
      if (!finding.reminder50Sent) {
        await sendEmail(reminderEmail(finding, finding.asset, 50));
        updates.reminder50Sent = true;
        sent.reminder50++;
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.finding.update({ where: { id: finding.id }, data: updates });
    }
  }

  return sent;
}

/**
 * Called whenever a new finding is created, or its severity changes.
 * Looks up the configured SLA-days for that severity and sets the deadline.
 */
async function assignSlaDeadline(finding) {
  const config = await prisma.slaConfig.findUnique({
    where: { severity: finding.severity },
  });
  const days = config?.slaDays ?? defaultSlaDays(finding.severity);
  const deadline = new Date(finding.firstDetectedAt);
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

function defaultSlaDays(severity) {
  switch (severity) {
    case "CRITICAL":
      return 3;
    case "HIGH":
      return 14;
    case "MEDIUM":
      return 30;
    default:
      return 90;
  }
}

module.exports = { runSlaCheck, assignSlaDeadline };
