import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../database/prisma.service";

export interface AuditInput {
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  traceId: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  create(
    input: AuditInput,
    database: Prisma.TransactionClient = this.prisma,
  ): Promise<unknown> {
    return database.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        traceId: input.traceId,
        metadata: input.metadata ?? {},
      },
    });
  }
}
