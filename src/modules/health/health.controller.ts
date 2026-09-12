import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiProperty, ApiTags } from "@nestjs/swagger";

import { Public } from "../../common/decorators/public.decorator";
import { HealthService } from "./health.service";

export class HealthResponseDto {
  @ApiProperty({ enum: ["ok"], example: "ok" })
  status: "ok";

  @ApiProperty({ enum: ["up"], example: "up" })
  database: "up";
}

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  check(): Promise<HealthResponseDto> {
    return this.health.check();
  }
}
