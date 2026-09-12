import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import accessControl from "../config/access-control.json" with { type: "json" };
import { assertDatabaseTarget } from "../scripts/guard-database-target.mjs";

assertDatabaseTarget();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  await prisma.$transaction(async (transaction) => {
    const permissionIds = new Map();

    for (const permission of accessControl.permissions) {
      const saved = await transaction.permission.upsert({
        where: { code: permission.code },
        update: { description: permission.description },
        create: permission,
      });
      permissionIds.set(saved.code, saved.id);
    }

    for (const definition of accessControl.systemRoles) {
      const role = await transaction.role.upsert({
        where: { code: definition.code },
        update: {
          name: definition.name,
          description: definition.description,
          isSystem: true,
          isActive: true,
        },
        create: {
          code: definition.code,
          name: definition.name,
          description: definition.description,
          isSystem: true,
        },
      });

      const permissionCodes = definition.permissions.includes("*")
        ? accessControl.permissions.map((permission) => permission.code)
        : definition.permissions;

      await transaction.rolePermission.deleteMany({
        where: { roleId: role.id },
      });
      await transaction.rolePermission.createMany({
        data: permissionCodes.map((code) => ({
          roleId: role.id,
          permissionId: permissionIds.get(code),
        })),
      });
    }
  });

  process.stdout.write("Access-control catalog seeded.\n");
} finally {
  await prisma.$disconnect();
  await pool.end();
}
