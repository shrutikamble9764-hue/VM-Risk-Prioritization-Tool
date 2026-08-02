// ============================================================
// SEED ROUTE
// A browser-triggerable alternative to `npm run seed`, for
// hosting plans (e.g. Render free tier) that don't provide
// Shell/Console access.
//
// SECURITY: protected by a secret key (SEED_SECRET env var) that
// must be passed as a query parameter. Without a matching secret
// set on the server, this endpoint refuses to run at all.
// ============================================================

const express = require("express");
const { seedDatabase } = require("../services/seedAdmin.service");

const router = express.Router();

router.get("/", async (req, res) => {
  const configuredSecret = process.env.SEED_SECRET;

  if (!configuredSecret) {
    return res.status(403).json({
      error: "Seeding via HTTP is disabled. Set a SEED_SECRET environment variable on the server to enable it.",
    });
  }

  if (req.query.key !== configuredSecret) {
    return res.status(403).json({ error: "Invalid or missing key." });
  }

  try {
    const result = await seedDatabase();
    res.json({
      message: "Seed complete.",
      adminEmail: result.adminEmail,
      adminPassword: result.adminAlreadyExisted
        ? "(unchanged - this account already existed)"
        : result.adminPassword,
      note: "Log in now, then remove the SEED_SECRET environment variable so this endpoint can no longer run.",
    });
  } catch (err) {
    console.error("[seed route] failed:", err);
    res.status(500).json({ error: "Seeding failed. Check server logs." });
  }
});

module.exports = router;
