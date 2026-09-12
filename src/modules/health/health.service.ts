import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import type { HealthResponseDto } from "./health.controller";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponseDto> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", database: "up" };
  }
}
