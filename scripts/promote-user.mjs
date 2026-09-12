import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { assertDatabaseTarget } from "./guard-database-target.mjs";

assertDatabaseTarget();

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  throw new Error("Usage: pnpm user:promote -- user@example.com");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  await prisma.$transaction(async (transaction) => {
    const [user, role] = await Promise.all([
      transaction.user.findUnique({ where: { email } }),
      transaction.role.findUnique({ where: { code: "super-admin" } }),
    ]);
    if (!user) throw new Error(`User not found: ${email}`);
    if (!role?.isActive)
      throw new Error("The super-admin role has not been seeded.");

    await transaction.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {
        status: "ACTIVE",
        assignedAt: new Date(),
        revokedAt: null,
        revokedById: null,
      },
    });
    await transaction.user.update({
      where: { id: user.id },
      data: { accessVersion: { increment: 1 } },
    });
    await transaction.auditEvent.create({
      data: {
        actorId: user.id,
        action: "user.promoted-by-operator",
        resource: "user",
        resourceId: user.id,
        traceId: "operator-cli",
        metadata: { role: "super-admin" },
      },
    });
  });
  process.stdout.write(
    `Promoted ${email} to super-admin. Existing access tokens are now invalid.\n`,
  );
} finally {
  await prisma.$disconnect();
  await pool.end();
}
