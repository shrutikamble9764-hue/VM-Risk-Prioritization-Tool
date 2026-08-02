// ============================================================
// SEED SCRIPT
// Run once after your first migration: `npm run seed`
// Creates: default SLA config, one team, and one ADMIN user
// so you have a way to log in for the first time.
// ============================================================

const { PrismaClient } = require("@prisma/client");
const { seedDatabase } = require("../src/services/seedAdmin.service");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");
  const result = await seedDatabase();
  console.log("---------------------------------------------");
  console.log("Seed complete. Login with:");
  console.log(`  email:    ${result.adminEmail}`);
  console.log(`  password: ${result.adminPassword || "(unchanged - account already existed)"}`);
  console.log("(set SEED_ADMIN_EMAIL & SEED_ADMIN_PASSWORD env vars before seeding in production)");
  console.log("---------------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
