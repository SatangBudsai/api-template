import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";

export const logoutScopes = ["CURRENT_DEVICE", "ALL_DEVICES"] as const;
export type LogoutScope = (typeof logoutScopes)[number];

export class LogoutDto {
  @ApiPropertyOptional({ enum: logoutScopes, default: "CURRENT_DEVICE" })
  @IsOptional()
  @IsIn(logoutScopes)
  scope: LogoutScope = "CURRENT_DEVICE";
}
