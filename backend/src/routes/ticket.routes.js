const express = require("express");
const prisma = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const tickets = await prisma.ticket.findMany({
    include: {
      finding: { include: { asset: { include: { owner: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(tickets);
});

router.get("/:id", async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: { finding: { include: { asset: { include: { owner: true } } } } },
  });
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json(ticket);
});

// Bulk assign / reassign owner across multiple findings (e.g. after mass patch)
router.post("/bulk/reassign", requireRole("ADMIN", "SECURITY_ANALYST"), async (req, res) => {
  const { findingIds, newOwnerId } = req.body;
  if (!Array.isArray(findingIds) || !newOwnerId) {
    return res.status(400).json({ error: "findingIds[] and newOwnerId required" });
  }
  const assetIds = await prisma.finding.findMany({
    where: { id: { in: findingIds } },
    select: { assetId: true },
  });
  const uniqueAssetIds = [...new Set(assetIds.map((a) => a.assetId))];
  await prisma.asset.updateMany({
    where: { id: { in: uniqueAssetIds } },
    data: { ownerId: newOwnerId },
  });
  res.json({ message: `Reassigned ${uniqueAssetIds.length} asset(s) to new owner.` });
});

// Bulk close after mass patch (still requires each finding to go through rescan-pending state)
router.post("/bulk/mark-fixed", requireRole("ADMIN", "SECURITY_ANALYST"), async (req, res) => {
  const { findingIds } = req.body;
  if (!Array.isArray(findingIds)) return res.status(400).json({ error: "findingIds[] required" });
  await prisma.finding.updateMany({
    where: { id: { in: findingIds } },
    data: { status: "RESCAN_PENDING" },
  });
  res.json({ message: `${findingIds.length} finding(s) moved to Rescan Pending.` });
});

module.exports = router;
