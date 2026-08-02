// ============================================================
// THREAT INTEL SERVICE
// Polls REAL public feeds:
//   - CISA KEV (Known Exploited Vulnerabilities) - JSON, free, no key
//   - FIRST.org EPSS API - free, no key
// Caches results locally, then re-scores every OPEN finding whose
// CVE just entered KEV or got a new EPSS score. This is what
// solves the "risk score never updates when the threat changes"
// problem in legacy scanners.
// ============================================================

const fetch = require("node-fetch");
const prisma = require("../config/db");
const { computeRiskScore } = require("./riskScoring.service");
const { sendEmail } = require("./email.service");
const { newlyKevEmail } = require("../templates/emailTemplates");

const KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const EPSS_URL = "https://api.first.org/data/v1/epss"; // supports ?cve=CVE-xxxx-xxxx

/**
 * Pull the full CISA KEV catalog and update our local cache.
 * Returns the list of CVE IDs that are NEWLY added to KEV since last sync
 * (these need urgent re-scoring + alerting).
 */
async function syncKev() {
  const res = await fetch(KEV_URL);
  if (!res.ok) throw new Error(`KEV fetch failed: ${res.status}`);
  const data = await res.json();
  const kevCves = new Set((data.vulnerabilities || []).map((v) => v.cveID));

  const existing = await prisma.threatIntelCache.findMany({
    where: { inKev: true },
    select: { cveId: true },
  });
  const alreadyKnownKev = new Set(existing.map((e) => e.cveId));

  const newlyKev = [...kevCves].filter((c) => !alreadyKnownKev.has(c));

  // Upsert all KEV CVEs
  for (const cve of kevCves) {
    await prisma.threatIntelCache.upsert({
      where: { cveId: cve },
      update: { inKev: true },
      create: { cveId: cve, inKev: true },
    });
  }

  return newlyKev;
}

/**
 * Fetch current EPSS scores for a specific batch of CVE IDs (max ~100 per call
 * is safe) and update the cache.
 */
async function syncEpssForCves(cveIds) {
  if (!cveIds.length) return;
  const chunks = chunk(cveIds, 90);
  for (const c of chunks) {
    const url = `${EPSS_URL}?cve=${c.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = await res.json();
    for (const row of data.data || []) {
      await prisma.threatIntelCache.upsert({
        where: { cveId: row.cve },
        update: { epssScore: parseFloat(row.epss) },
        create: { cveId: row.cve, epssScore: parseFloat(row.epss) },
      });
    }
  }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Main job: sync feeds, then re-score every OPEN finding whose CVE
 * changed status (new KEV entry, updated EPSS). Sends an immediate
 * alert email if a finding's CVE just became actively exploited.
 */
async function refreshThreatIntelAndRescore() {
  const newlyKev = await syncKev();

  const openFindings = await prisma.finding.findMany({
    where: {
      cveId: { not: null },
      status: { in: ["NEW", "TRIAGED", "IN_PROGRESS", "RESCAN_PENDING"] },
    },
    include: { asset: { include: { owner: true } } },
  });

  const cveIds = [...new Set(openFindings.map((f) => f.cveId).filter(Boolean))];
  await syncEpssForCves(cveIds);

  const intel = await prisma.threatIntelCache.findMany({
    where: { cveId: { in: cveIds } },
  });
  const intelMap = new Map(intel.map((i) => [i.cveId, i]));

  for (const finding of openFindings) {
    const cached = intelMap.get(finding.cveId);
    const inKev = cached?.inKev ?? finding.inKev;
    const epssScore = cached?.epssScore ?? finding.epssScore ?? 0;

    const { score, breakdown, severity } = computeRiskScore({
      cvssScore: finding.cvssScore || 0,
      epssScore,
      inKev,
      hasPublicExploit: finding.hasPublicExploit,
      assetCriticality: finding.asset.criticality,
      internetFacing: finding.asset.internetFacing,
      dataSensitive: finding.asset.dataSensitive,
      compensatingControls: finding.asset.compensatingControls,
    });

    const becameNewlyKev = newlyKev.includes(finding.cveId) && !finding.inKev;

    await prisma.finding.update({
      where: { id: finding.id },
      data: {
        inKev,
        epssScore,
        riskScore: score,
        riskBreakdown: breakdown,
        severity,
      },
    });

    if (becameNewlyKev && finding.asset.owner?.email) {
      await sendEmail(newlyKevEmail(finding, finding.asset));
    }
  }

  return { newlyKevCount: newlyKev.length, rescored: openFindings.length };
}

module.exports = { refreshThreatIntelAndRescore, syncKev, syncEpssForCves };
