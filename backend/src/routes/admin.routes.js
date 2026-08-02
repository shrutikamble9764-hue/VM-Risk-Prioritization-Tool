const express = require("express");
const prisma = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/sla-config", async (req, res) => {
  const configs = await prisma.slaConfig.findMany();
  res.json(configs);
});

router.put("/sla-config/:severity", requireRole("ADMIN"), async (req, res) => {
  const { slaDays } = req.body;
  const config = await prisma.slaConfig.upsert({
    where: { severity: req.params.severity },
    update: { slaDays },
    create: { severity: req.params.severity, slaDays },
  });
  res.json(config);
});

router.get("/teams", async (req, res) => {
  const teams = await prisma.team.findMany({ include: { users: true, assets: true } });
  res.json(teams);
});

router.post("/teams", requireRole("ADMIN"), async (req, res) => {
  const team = await prisma.team.create({ data: { name: req.body.name } });
  res.status(201).json(team);
});

router.get("/users", requireRole("ADMIN", "SECURITY_ANALYST"), async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, teamId: true },
  });
  res.json(users);
});

module.exports = router;
