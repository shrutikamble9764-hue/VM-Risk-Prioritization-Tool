// ============================================================
// SCHEDULER
// Registers all recurring background jobs. Uses node-cron so
// there's no need to run a separate worker process or Redis -
// everything runs inside the same Node process, which keeps
// deployment simple for a small/medium install (a few thousand assets).
// ============================================================

const cron = require("node-cron");
const { runSlaCheck } = require("./sla.service");
const { refreshThreatIntelAndRescore } = require("./threatIntel.service");

function startScheduler() {
  // SLA reminder/escalation check - once a day at 8:00 AM server time
  cron.schedule("0 8 * * *", async () => {
    console.log("[scheduler] running daily SLA check...");
    try {
      const result = await runSlaCheck();
      console.log("[scheduler] SLA check complete:", result);
    } catch (err) {
      console.error("[scheduler] SLA check failed:", err.message);
    }
  });

  // Threat intel (KEV + EPSS) refresh - every 4 hours, so a CVE
  // moving into "actively exploited" status gets caught same-day,
  // not on the next weekly scan cycle.
  cron.schedule("0 */4 * * *", async () => {
    console.log("[scheduler] refreshing threat intel...");
    try {
      const result = await refreshThreatIntelAndRescore();
      console.log("[scheduler] threat intel refresh complete:", result);
    } catch (err) {
      console.error("[scheduler] threat intel refresh failed:", err.message);
    }
  });

  console.log("[scheduler] background jobs registered (SLA daily @08:00, threat intel every 4h)");
}

module.exports = { startScheduler };
