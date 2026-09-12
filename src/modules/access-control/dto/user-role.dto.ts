import { ApiProperty } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsString } from "class-validator";

export class ReplaceUserRolesDto {
  @ApiProperty({ type: [String], example: ["user", "content-editor"] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roleCodes: string[];
}

export class UserRolesResponseDto {
  @ApiProperty({ format: "uuid" }) userId: string;
  @ApiProperty({ type: [String] }) roles: string[];
}
