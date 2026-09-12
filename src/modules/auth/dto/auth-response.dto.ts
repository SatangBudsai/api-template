import { ApiProperty } from "@nestjs/swagger";

export class AuthAccountDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "email" })
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: [String], example: ["user"] })
  roles: string[];

  @ApiProperty({ type: [String], example: ["account:read"] })
  permissions: string[];
}

export class AuthSessionResponseDto {
  @ApiProperty({ description: "Compact JWE access token." })
  accessToken: string;

  @ApiProperty({ format: "date-time" })
  accessTokenExpiresAt: string;

  @ApiProperty({ description: "Send as x-csrf-token for refresh and logout." })
  csrfToken: string;

  @ApiProperty({ type: AuthAccountDto })
  account: AuthAccountDto;
}

export class AuthSessionListItemDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  current: boolean;

  @ApiProperty({ format: "date-time" })
  issuedAt: string;

  @ApiProperty({ format: "date-time" })
  lastUsedAt: string;

  @ApiProperty({ format: "date-time" })
  expiresAt: string;
}
