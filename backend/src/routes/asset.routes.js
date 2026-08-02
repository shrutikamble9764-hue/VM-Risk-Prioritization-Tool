const express = require("express");
const prisma = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// List assets (with basic filters)
router.get("/", async (req, res) => {
  const { criticality, environment, ownerId } = req.query;
  const assets = await prisma.asset.findMany({
    where: {
      ...(criticality && { criticality }),
      ...(environment && { environment }),
      ...(ownerId && { ownerId }),
    },
    include: { owner: true, team: true, _count: { select: { findings: true } } },
    orderBy: { discoveredAt: "desc" },
  });
  res.json(assets);
});

// Get one asset with its findings
router.get("/:id", async (req, res) => {
  const asset = await prisma.asset.findUnique({
    where: { id: req.params.id },
    include: { owner: true, team: true, findings: true },
  });
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  res.json(asset);
});

// Create asset (manual registration)
router.post("/", requireRole("ADMIN", "SECURITY_ANALYST"), async (req, res) => {
  const asset = await prisma.asset.create({ data: req.body });
  res.status(201).json(asset);
});

// Update asset (e.g. change criticality, owner, compensating controls)
router.put("/:id", requireRole("ADMIN", "SECURITY_ANALYST"), async (req, res) => {
  const asset = await prisma.asset.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(asset);
});

// Exposure summary - "how healthy is our coverage"
router.get("/reports/exposure-summary", async (req, res) => {
  const total = await prisma.asset.count();
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 30);

  const staleAssets = await prisma.asset.count({
    where: {
      OR: [{ lastScannedAt: null }, { lastScannedAt: { lt: staleThreshold } }],
    },
  });
  const rogueAssets = await prisma.asset.count({ where: { isRogue: true } });

  res.json({
    totalAssets: total,
    staleAssets, // not scanned in 30+ days
    rogueAssets, // discovered but not pre-registered
    coveragePercent: total ? Math.round(((total - staleAssets) / total) * 100) : 0,
  });
});

// Bulk import assets (from CSV parsed on the frontend into JSON)
// body: { assets: [{ hostname, ip, os, environment, internetFacing, criticality, dataSensitive, ownerEmail }, ...] }
router.post("/bulk", requireRole("ADMIN", "SECURITY_ANALYST"), async (req, res) => {
  const { assets } = req.body;
  if (!Array.isArray(assets) || assets.length === 0) {
    return res.status(400).json({ error: "assets[] array required" });
  }

  const results = { created: 0, failed: 0, errors: [] };

  for (const [i, row] of assets.entries()) {
    try {
      let ownerId = undefined;
      if (row.ownerEmail) {
        const owner = await prisma.user.findUnique({ where: { email: row.ownerEmail } });
        if (owner) ownerId = owner.id;
      }

      await prisma.asset.create({
        data: {
          hostname: row.hostname,
          ip: row.ip || null,
          os: row.os || null,
          environment: (row.environment || "PROD").toUpperCase(),
          internetFacing: parseBool(row.internetFacing),
          criticality: (row.criticality || "MEDIUM").toUpperCase(),
          dataSensitive: parseBool(row.dataSensitive),
          compensatingControls: row.compensatingControls
            ? String(row.compensatingControls).split(";").map((s) => s.trim()).filter(Boolean)
            : [],
          ownerId,
        },
      });
      results.created++;
    } catch (err) {
      results.failed++;
      results.errors.push({ row: i + 1, hostname: row.hostname, error: err.message });
    }
  }

  res.status(201).json(results);
});

function parseBool(val) {
  if (typeof val === "boolean") return val;
  if (!val) return false;
  return ["true", "1", "yes", "y"].includes(String(val).trim().toLowerCase());
}

module.exports = router;
