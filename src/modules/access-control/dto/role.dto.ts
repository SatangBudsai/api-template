import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateRoleDto {
  @ApiProperty({ example: "content-editor", pattern: "^[a-z][a-z0-9-]*$" })
  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/)
  @MaxLength(80)
  code: string;

  @ApiProperty({ example: "Content editor" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ type: [String], example: ["account:read"] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionCodes: string[];
}

export class UpdateRoleDto extends PartialType(
  OmitType(CreateRoleDto, ["code", "permissionCodes"] as const),
) {}

export class ReplaceRolePermissionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionCodes: string[];
}

export class RoleResponseDto {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;
  @ApiProperty() isSystem: boolean;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ type: [String] }) permissions: string[];
}

export class PermissionResponseDto {
  @ApiProperty() code: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;
}
