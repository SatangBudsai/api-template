import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ProblemDetailsDto {
  @ApiProperty({ example: "https://api-template.dev/problems/auth-login" })
  type: string;

  @ApiProperty({ example: "Unauthorized" })
  title: string;

  @ApiProperty({ example: 401 })
  status: number;

  @ApiProperty({ example: "Email or password is incorrect." })
  detail: string;

  @ApiProperty({ example: "/api/auth/login" })
  instance: string;

  @ApiProperty({ example: "AUTH_LOGIN_001" })
  code: string;

  @ApiProperty({ example: "442c2bc8-a9de-4bf8-825d-b3cc9fa636f7" })
  traceId: string;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "array", items: { type: "string" } },
  })
  errors?: Record<string, string[]>;
}
