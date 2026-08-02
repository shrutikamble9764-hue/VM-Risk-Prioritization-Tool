const express = require("express");
const prisma = require("../config/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/summary", async (req, res) => {
  const allFindings = await prisma.finding.findMany({
    include: { asset: true },
  });

  const open = allFindings.filter((f) =>
    ["NEW", "TRIAGED", "IN_PROGRESS", "RESCAN_PENDING"].includes(f.status)
  );
  const closed = allFindings.filter((f) => f.status === "VERIFIED_CLOSED" && f.closedAt);

  // --- Severity distribution (open only) ---
  const severityDistribution = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of open) severityDistribution[f.severity]++;

  // --- MTTR (Mean Time To Remediate), by severity, in days ---
  const mttrBuckets = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
  for (const f of closed) {
    const days = (f.closedAt.getTime() - f.firstDetectedAt.getTime()) / (1000 * 60 * 60 * 24);
    mttrBuckets[f.severity].push(days);
  }
  const mttr = {};
  for (const sev of Object.keys(mttrBuckets)) {
    const arr = mttrBuckets[sev];
    mttr[sev] = arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
  }

  // --- Aging report: open findings >30/60/90 days ---
  const now = Date.now();
  const aging = { over30: 0, over60: 0, over90: 0 };
  for (const f of open) {
    const ageDays = (now - f.firstDetectedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 90) aging.over90++;
    else if (ageDays > 60) aging.over60++;
    else if (ageDays > 30) aging.over30++;
  }

  // --- SLA compliance % ---
  const withDeadline = allFindings.filter((f) => f.slaDeadline);
  const breached = withDeadline.filter(
    (f) => f.status !== "VERIFIED_CLOSED" && f.slaDeadline.getTime() < now
  ).length;
  const upcomingBreaches = open.filter((f) => {
    if (!f.slaDeadline) return false;
    const daysLeft = (f.slaDeadline.getTime() - now) / (1000 * 60 * 60 * 24);
    return daysLeft >= 0 && daysLeft <= 3;
  }).length;
  const slaCompliancePercent = withDeadline.length
    ? Math.round(((withDeadline.length - breached) / withDeadline.length) * 100)
    : 100;

  // --- False positive rate ---
  const fpCount = allFindings.filter((f) => f.status === "FALSE_POSITIVE").length;
  const fpRate = allFindings.length ? Math.round((fpCount / allFindings.length) * 1000) / 10 : 0;

  // --- KEV overlay: how many open findings are actively exploited ---
  const activeExploitCount = open.filter((f) => f.inKev).length;

  // --- Overall risk posture score (avg risk score of open findings, weighted by count) ---
  const riskPosture = open.length
    ? Math.round((open.reduce((sum, f) => sum + f.riskScore, 0) / open.length) * 10) / 10
    : 0;

  // --- Top vulnerable assets ---
  const assetRiskMap = new Map();
  for (const f of open) {
    const key = f.asset.id;
    const cur = assetRiskMap.get(key) || { hostname: f.asset.hostname, totalRisk: 0, count: 0 };
    cur.totalRisk += f.riskScore;
    cur.count += 1;
    assetRiskMap.set(key, cur);
  }
  const topVulnerableAssets = [...assetRiskMap.values()]
    .sort((a, b) => b.totalRisk - a.totalRisk)
    .slice(0, 10);

  res.json({
    riskPosture,
    severityDistribution,
    mttr,
    aging,
    slaCompliancePercent,
    breachedCount: breached,
    upcomingBreaches,
    fpRate,
    activeExploitCount,
    topVulnerableAssets,
    totalOpenFindings: open.length,
    totalClosedFindings: closed.length,
  });
});

module.exports = router;
