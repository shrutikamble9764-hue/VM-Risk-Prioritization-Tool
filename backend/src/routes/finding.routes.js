const express = require("express");
const prisma = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { computeRiskScore, clampNumber } = require("../services/riskScoring.service");
const { assignSlaDeadline } = require("../services/sla.service");
const { sendEmail } = require("../services/email.service");
const {
  newFindingEmail,
  verifiedClosedEmail,
  reopenedEmail,
} = require("../templates/emailTemplates");

const router = express.Router();
router.use(requireAuth);

// List findings with filters (status, severity, asset, owner)
router.get("/", async (req, res) => {
  const { status, severity, assetId } = req.query;
  const findings = await prisma.finding.findMany({
    where: {
      ...(status && { status }),
      ...(severity && { severity }),
      ...(assetId && { assetId }),
    },
    include: { asset: { include: { owner: true } }, ticket: true },
    orderBy: { riskScore: "desc" },
  });
  res.json(findings);
});

router.get("/:id", async (req, res) => {
  const finding = await prisma.finding.findUnique({
    where: { id: req.params.id },
    include: {
      asset: { include: { owner: true, team: true } },
      ticket: true,
      rescanLogs: { orderBy: { createdAt: "desc" } },
      fpRequest: true,
      riskAcceptance: true,
    },
  });
  if (!finding) return res.status(404).json({ error: "Finding not found" });
  res.json(finding);
});

/**
 * CREATE a new finding.
 * This is what a scanner integration (or manual entry) calls.
 * It automatically:
 *  1. Computes the composite risk score
 *  2. Assigns an SLA deadline based on severity
 *  3. Creates a linked ticket
 *  4. Emails the asset owner immediately
 */
router.post("/", requireRole("ADMIN", "SECURITY_ANALYST"), async (req, res) => {
  const {
    cveId,
    title,
    description,
    assetId,
    cvssScore,
    epssScore,
    inKev,
    hasPublicExploit,
    remediationAdvice,
  } = req.body;

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { owner: true },
  });
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const safeCvssScore = clampNumber(cvssScore, 0, 10, 0);
  const safeEpssScore = clampNumber(epssScore, 0, 1, 0);

  const { score, breakdown, severity } = computeRiskScore({
    cvssScore: safeCvssScore,
    epssScore: safeEpssScore,
    inKev,
    hasPublicExploit,
    assetCriticality: asset.criticality,
    internetFacing: asset.internetFacing,
    dataSensitive: asset.dataSensitive,
    compensatingControls: asset.compensatingControls,
  });

  const finding = await prisma.finding.create({
    data: {
      cveId,
      title,
      description,
      assetId,
      cvssScore: safeCvssScore,
      epssScore: safeEpssScore,
      inKev: inKev || false,
      hasPublicExploit: hasPublicExploit || false,
      riskScore: score,
      riskBreakdown: breakdown,
      severity,
      remediationAdvice,
    },
  });

  const slaDeadline = await assignSlaDeadline(finding);
  const updated = await prisma.finding.update({
    where: { id: finding.id },
    data: { slaDeadline },
  });

  await prisma.ticket.create({
    data: {
      findingId: finding.id,
      history: [{ status: "NEW", at: new Date().toISOString(), by: "system" }],
    },
  });

  if (asset.owner?.email) {
    await sendEmail(newFindingEmail(updated, asset));
  }

  res.status(201).json(updated);
});

// Update finding status (generic status transitions e.g. Triaged, In Progress)
router.patch("/:id/status", requireRole("ADMIN", "SECURITY_ANALYST", "ASSET_OWNER"), async (req, res) => {
  const { status } = req.body;
  const finding = await prisma.finding.update({
    where: { id: req.params.id },
    data: { status },
  });

  await prisma.ticket.update({
    where: { findingId: req.params.id },
    data: {
      history: { push: { status, at: new Date().toISOString(), by: req.user.email } },
    },
  }).catch(() => {}); // ticket might not exist in edge cases

  res.json(finding);
});

/**
 * "Mark Fixed" -> does NOT close the finding directly.
 * It moves to RESCAN_PENDING. A real scan integration (Phase 2, Nuclei)
 * or a manual "Confirm Rescan Result" call is what actually closes it.
 * This enforces the "no fake-closed tickets" rule.
 */
router.post("/:id/mark-fixed", requireRole("ADMIN", "SECURITY_ANALYST", "ASSET_OWNER"), async (req, res) => {
  const finding = await prisma.finding.update({
    where: { id: req.params.id },
    data: { status: "RESCAN_PENDING" },
  });
  res.json({ message: "Marked as fixed. Awaiting verification rescan before closing.", finding });
});

/**
 * Record the result of a verification rescan (manual entry for now;
 * Phase 2 wires this to the real Nuclei scanner automatically).
 * body: { result: "fixed" | "still_vulnerable", notes }
 */
router.post("/:id/rescan-result", requireRole("ADMIN", "SECURITY_ANALYST"), async (req, res) => {
  const { result, notes } = req.body;
  const finding = await prisma.finding.findUnique({
    where: { id: req.params.id },
    include: { asset: { include: { owner: true } } },
  });
  if (!finding) return res.status(404).json({ error: "Finding not found" });

  await prisma.rescanLog.create({
    data: {
      findingId: finding.id,
      triggeredBy: req.user.id,
      result: result === "fixed" ? "fixed" : "still_vulnerable",
      notes,
    },
  });

  if (result === "fixed") {
    const updated = await prisma.finding.update({
      where: { id: finding.id },
      data: { status: "VERIFIED_CLOSED", closedAt: new Date() },
    });
    await sendEmail(verifiedClosedEmail(updated, finding.asset));
    return res.json({ message: "Verified and closed.", finding: updated });
  } else {
    const updated = await prisma.finding.update({
      where: { id: finding.id },
      data: { status: "IN_PROGRESS" },
    });
    await sendEmail(reopenedEmail(updated, finding.asset));
    return res.json({ message: "Rescan failed - reopened.", finding: updated });
  }
});

// --- FALSE POSITIVE WORKFLOW ---

router.post("/:id/false-positive/request", requireRole("ADMIN", "SECURITY_ANALYST", "ASSET_OWNER"), async (req, res) => {
  const { reason, scope, expiresAt } = req.body;
  const fp = await prisma.falsePositiveRequest.create({
    data: {
      findingId: req.params.id,
      reason,
      scope: scope || "asset_cve",
      requestedBy: req.user.email,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });
  res.status(201).json(fp);
});

// Only a senior analyst/admin can approve, so the FP flag can't be abused to dodge SLA
router.post("/:id/false-positive/review", requireRole("ADMIN", "SECURITY_ANALYST"), async (req, res) => {
  const { approve } = req.body;
  const fp = await prisma.falsePositiveRequest.update({
    where: { findingId: req.params.id },
    data: { status: approve ? "APPROVED" : "REJECTED", reviewedBy: req.user.email },
  });
  if (approve) {
    await prisma.finding.update({
      where: { id: req.params.id },
      data: { status: "FALSE_POSITIVE" },
    });
  }
  res.json(fp);
});

// --- RISK ACCEPTANCE WORKFLOW ---

router.post("/:id/risk-acceptance/request", requireRole("ADMIN", "SECURITY_ANALYST", "ASSET_OWNER"), async (req, res) => {
  const { justification, expiresAt } = req.body;
  if (!expiresAt) return res.status(400).json({ error: "expiresAt is required for risk acceptance" });
  const ra = await prisma.riskAcceptance.create({
    data: {
      findingId: req.params.id,
      justification,
      requestedBy: req.user.email,
      expiresAt: new Date(expiresAt),
    },
  });
  res.status(201).json(ra);
});

router.post("/:id/risk-acceptance/review", requireRole("ADMIN", "SECURITY_ANALYST"), async (req, res) => {
  const { approve } = req.body;
  const ra = await prisma.riskAcceptance.update({
    where: { findingId: req.params.id },
    data: { status: approve ? "APPROVED" : "DENIED", reviewedBy: req.user.email },
  });
  if (approve) {
    await prisma.finding.update({
      where: { id: req.params.id },
      data: { status: "RISK_ACCEPTED" },
    });
  }
  res.json(ra);
});

// Bulk import findings (from CSV parsed on the frontend into JSON)
// Matches each row to an asset by hostname. Computes risk score + SLA +
// creates a ticket for each, same as single-create, but does NOT send
// individual owner emails (to avoid flooding inboxes during a mass import).
// body: { findings: [{ assetHostname, cveId, title, description, cvssScore, epssScore, inKev, hasPublicExploit, remediationAdvice }, ...] }
router.post("/bulk", requireRole("ADMIN", "SECURITY_ANALYST"), async (req, res) => {
  const { findings } = req.body;
  if (!Array.isArray(findings) || findings.length === 0) {
    return res.status(400).json({ error: "findings[] array required" });
  }

  const results = { created: 0, failed: 0, errors: [] };

  for (const [i, row] of findings.entries()) {
    try {
      const asset = await prisma.asset.findFirst({ where: { hostname: row.assetHostname } });
      if (!asset) {
        results.failed++;
        results.errors.push({ row: i + 1, error: `No asset found with hostname "${row.assetHostname}"` });
        continue;
      }

      const cvssScore = clampNumber(row.cvssScore, 0, 10, 0);
      const epssScore = clampNumber(row.epssScore, 0, 1, 0);
      const inKev = parseBoolLocal(row.inKev);
      const hasPublicExploit = parseBoolLocal(row.hasPublicExploit);

      const { score, breakdown, severity } = computeRiskScore({
        cvssScore,
        epssScore,
        inKev,
        hasPublicExploit,
        assetCriticality: asset.criticality,
        internetFacing: asset.internetFacing,
        dataSensitive: asset.dataSensitive,
        compensatingControls: asset.compensatingControls,
      });

      const finding = await prisma.finding.create({
        data: {
          cveId: row.cveId || null,
          title: row.title || row.cveId || "Untitled finding",
          description: row.description || "",
          assetId: asset.id,
          cvssScore,
          epssScore,
          inKev,
          hasPublicExploit,
          riskScore: score,
          riskBreakdown: breakdown,
          severity,
          remediationAdvice: row.remediationAdvice || null,
        },
      });

      const slaDeadline = await assignSlaDeadline(finding);
      await prisma.finding.update({ where: { id: finding.id }, data: { slaDeadline } });

      await prisma.ticket.create({
        data: {
          findingId: finding.id,
          history: [{ status: "NEW", at: new Date().toISOString(), by: "bulk-import" }],
        },
      });

      results.created++;
    } catch (err) {
      results.failed++;
      results.errors.push({ row: i + 1, error: err.message });
    }
  }

  res.status(201).json(results);
});

function parseBoolLocal(val) {
  if (typeof val === "boolean") return val;
  if (!val) return false;
  return ["true", "1", "yes", "y"].includes(String(val).trim().toLowerCase());
}

module.exports = router;
