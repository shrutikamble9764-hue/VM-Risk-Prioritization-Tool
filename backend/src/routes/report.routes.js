const express = require("express");
const prisma = require("../config/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function toCsv(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((r) =>
    columns
      .map((c) => {
        const val = r[c] ?? "";
        let str = String(val);
        // CSV/Formula Injection protection: Excel/Sheets treats a leading
        // =, +, -, or @ as the start of a formula. Since these values can
        // originate from user input (finding titles, CVE descriptions),
        // prefix them with a tab character to neutralize execution while
        // keeping the visible text unchanged.
        if (/^[=+\-@]/.test(str)) {
          str = "\t" + str;
        }
        str = str.replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
}

// GET /api/reports/findings.csv?severity=CRITICAL&status=NEW&assetId=..&from=..&to=..
router.get("/findings.csv", async (req, res) => {
  const { severity, status, assetId, from, to } = req.query;

  const findings = await prisma.finding.findMany({
    where: {
      ...(severity && { severity }),
      ...(status && { status }),
      ...(assetId && { assetId }),
      ...(from || to
        ? {
            firstDetectedAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    },
    include: { asset: { include: { owner: true } } },
  });

  const rows = findings.map((f) => ({
    cveId: f.cveId,
    title: f.title,
    asset: f.asset.hostname,
    owner: f.asset.owner?.email || "",
    severity: f.severity,
    riskScore: f.riskScore,
    status: f.status,
    slaDeadline: f.slaDeadline ? f.slaDeadline.toISOString().slice(0, 10) : "",
    firstDetectedAt: f.firstDetectedAt.toISOString().slice(0, 10),
    inKev: f.inKev,
  }));

  const csv = toCsv(rows, [
    "cveId",
    "title",
    "asset",
    "owner",
    "severity",
    "riskScore",
    "status",
    "slaDeadline",
    "firstDetectedAt",
    "inKev",
  ]);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=findings_report.csv");
  res.send(csv);
});

// Executive summary (JSON, meant for a simple printable/exec view)
router.get("/executive-summary", async (req, res) => {
  const open = await prisma.finding.count({
    where: { status: { in: ["NEW", "TRIAGED", "IN_PROGRESS", "RESCAN_PENDING"] } },
  });
  const critical = await prisma.finding.count({
    where: { severity: "CRITICAL", status: { in: ["NEW", "TRIAGED", "IN_PROGRESS", "RESCAN_PENDING"] } },
  });
  const kev = await prisma.finding.count({
    where: { inKev: true, status: { in: ["NEW", "TRIAGED", "IN_PROGRESS", "RESCAN_PENDING"] } },
  });
  const totalAssets = await prisma.asset.count();

  res.json({
    generatedAt: new Date().toISOString(),
    totalOpenFindings: open,
    criticalOpenFindings: critical,
    activelyExploitedOpenFindings: kev,
    totalAssets,
  });
});

module.exports = router;
