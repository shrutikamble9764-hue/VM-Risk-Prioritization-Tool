// ============================================================
// SEED SERVICE
// Core logic for creating default SLA config, a default team,
// and an initial admin user. Used by:
//   - prisma/seed.js (CLI: `npm run seed`)
//   - routes/seed.routes.js (one-time HTTP endpoint, for hosts
//     like Render's free tier where a Shell/Console isn't available)
// ============================================================

const bcrypt = require("bcryptjs");
const prisma = require("../config/db");

async function seedDatabase() {
  const defaults = [
    { severity: "CRITICAL", slaDays: 3 },
    { severity: "HIGH", slaDays: 14 },
    { severity: "MEDIUM", slaDays: 30 },
    { severity: "LOW", slaDays: 90 },
  ];
  for (const d of defaults) {
    await prisma.slaConfig.upsert({
      where: { severity: d.severity },
      update: { slaDays: d.slaDays },
      create: d,
    });
  }

  const team = await prisma.team.upsert({
    where: { name: "Security Team" },
    update: {},
    create: { name: "Security Team" },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Admin",
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      teamId: team.id,
    },
  });

  return {
    adminEmail,
    adminAlreadyExisted: !!existing,
    // Only return the password on first creation - never echo it back
    // for an account that already existed, so re-running this doesn't
    // leak the current password of an account someone may have changed.
    adminPassword: existing ? undefined : adminPassword,
  };
}

module.exports = { seedDatabase };
