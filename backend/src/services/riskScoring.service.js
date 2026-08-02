// ============================================================
// RISK SCORING ENGINE
// This is the heart of the platform. Instead of just showing
// the raw CVSS score (like most scanners), we compute a
// transparent, weighted Composite Risk Score (0-10) and store
// EXACTLY how each factor contributed - so an analyst can see
// "why is this a 9.2?" instead of trusting a black box.
// ============================================================

const CRITICALITY_WEIGHT = {
  CRITICAL: 1.0,
  HIGH: 0.75,
  MEDIUM: 0.5,
  LOW: 0.25,
};

/**
 * Computes the composite risk score for a finding.
 * @param {Object} input
 * @param {number} input.cvssScore        0-10
 * @param {number} input.epssScore        0-1 (probability of exploitation)
 * @param {boolean} input.inKev           true if CVE is in CISA KEV list
 * @param {boolean} input.hasPublicExploit
 * @param {string} input.assetCriticality CRITICAL|HIGH|MEDIUM|LOW
 * @param {boolean} input.internetFacing
 * @param {boolean} input.dataSensitive   business/compliance sensitive data on asset
 * @param {string[]} input.compensatingControls e.g. ["WAF","EDR"]
 * @returns {{score:number, breakdown:object, severity:string}}
 */
function computeRiskScore(input) {
  const {
    cvssScore = 0,
    epssScore = 0,
    inKev = false,
    hasPublicExploit = false,
    assetCriticality = "MEDIUM",
    internetFacing = false,
    dataSensitive = false,
    compensatingControls = [],
  } = input;

  // Sanitize every numeric input up front. Real-world CSV exports (NVD/CISA
  // advisories, vendor bulletins) often contain blank cells, text like "N/A",
  // or percentages instead of clean numbers. Any of that must NEVER produce
  // NaN, which Postgres/Prisma will reject outright.
  const safeCvss = clampNumber(cvssScore, 0, 10, 0);
  const safeEpss = clampNumber(epssScore, 0, 1, 0);

  // --- Base: CVSS carries the most weight (technical severity) ---
  const cvssComponent = (safeCvss / 10) * 4.0; // max 4.0 points

  // --- EPSS: real-world exploitation probability ---
  const epssComponent = safeEpss * 2.0; // max 2.0 points

  // --- Threat intel: is this actively being exploited right now? ---
  let threatIntelComponent = 0;
  if (inKev) threatIntelComponent += 1.5; // confirmed active exploitation in the wild
  if (hasPublicExploit) threatIntelComponent += 0.5; // PoC exists, exploitation likely soon
  threatIntelComponent = Math.min(threatIntelComponent, 2.0); // cap at 2.0

  // --- Asset criticality: business tier of the affected system ---
  const criticalityComponent =
    (CRITICALITY_WEIGHT[assetCriticality] ?? 0.5) * 1.0; // max 1.0

  // --- Business impact: exposure + data sensitivity ---
  let businessImpactComponent = 0;
  if (internetFacing) businessImpactComponent += 0.5;
  if (dataSensitive) businessImpactComponent += 0.5;
  businessImpactComponent = Math.min(businessImpactComponent, 1.0); // max 1.0

  let rawScore =
    cvssComponent +
    epssComponent +
    threatIntelComponent +
    criticalityComponent +
    businessImpactComponent;

  // --- Compensating controls REDUCE effective risk ---
  // Each recognized control present knocks a bit off the final score,
  // reflecting that a WAF/EDR/etc. lowers real-world risk even if the
  // underlying vulnerability is unpatched.
  let controlsReduction = 0;
  const recognizedControls = ["WAF", "EDR", "IPS", "NETWORK_SEGMENTATION", "MFA"];
  for (const control of compensatingControls) {
    if (recognizedControls.includes(control)) {
      controlsReduction += 0.3;
    }
  }
  controlsReduction = Math.min(controlsReduction, 1.5); // cap total reduction

  let finalScore = Math.max(0, Math.min(10, rawScore - controlsReduction));
  finalScore = Math.round(finalScore * 10) / 10;
  // Absolute last line of defense: if anything upstream still produced
  // NaN/undefined for some unforeseen reason, never let it reach the DB.
  if (!Number.isFinite(finalScore)) finalScore = 0;

  const breakdown = {
    cvss: { raw: safeCvss, contribution: round1(cvssComponent), maxPoints: 4.0 },
    epss: { raw: safeEpss, contribution: round1(epssComponent), maxPoints: 2.0 },
    threatIntel: {
      inKev,
      hasPublicExploit,
      contribution: round1(threatIntelComponent),
      maxPoints: 2.0,
    },
    assetCriticality: {
      raw: assetCriticality,
      contribution: round1(criticalityComponent),
      maxPoints: 1.0,
    },
    businessImpact: {
      internetFacing,
      dataSensitive,
      contribution: round1(businessImpactComponent),
      maxPoints: 1.0,
    },
    compensatingControls: {
      applied: compensatingControls,
      reduction: -round1(controlsReduction),
    },
    finalScore,
  };

  return {
    score: finalScore,
    breakdown,
    severity: scoreToSeverity(finalScore),
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Safely coerces any input (string, number, blank, garbage text) into a
 * finite number within [min, max]. Falls back to `fallback` for anything
 * that isn't a valid number - this is what prevents bad CSV data (blank
 * cells, "N/A", stray text) from ever producing NaN in a risk score.
 */
function clampNumber(value, min, max, fallback) {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function scoreToSeverity(score) {
  if (score >= 9.0) return "CRITICAL";
  if (score >= 7.0) return "HIGH";
  if (score >= 4.0) return "MEDIUM";
  return "LOW";
}

module.exports = { computeRiskScore, scoreToSeverity, clampNumber };
