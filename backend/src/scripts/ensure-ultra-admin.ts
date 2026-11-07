import { PrismaClient, Role } from "../generated/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "ultraadmin@kyrazam.com";
  const password = "UltraAdmin@2025";
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        roles: [Role.ULTRA_ADMIN],
        isActive: true,
        passwordHash
      }
    });
    console.log("✓ Updated existing user to ULTRA_ADMIN: ultraadmin@kyrazam.com");
  } else {
    await prisma.user.create({
      data: {
        id: "00000000-0000-0000-0000-000000000000",
        name: "Master Ultra Admin",
        email,
        passwordHash,
        roles: [Role.ULTRA_ADMIN],
        isActive: true
      }
    });
    console.log("✓ Created initial ULTRA_ADMIN user: ultraadmin@kyrazam.com");
  }
}

main()
  .catch((e) => {
    console.error("Error creating ultra admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

