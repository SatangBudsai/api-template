import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import { ValidationPipe } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { allowedOrigins, configString } from "./common/config/config-values";
import { ProblemDetailsFilter } from "./common/errors/problem-details.filter";
import { ProblemDetailsDto } from "./common/errors/problem-details.dto";
import { validationAppError } from "./common/errors/validation-error";

export interface CreateApplicationOptions {
  logger?: false;
}

export async function createApplication(
  options: CreateApplicationOptions = {},
): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, logger: false }),
    options.logger === false ? { logger: false } : {},
  );
  const config = app.get(ConfigService);
  const origins = new Set(allowedOrigins(config));

  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  app.enableCors({
    credentials: true,
    origin(origin, callback) {
      const normalized = origin?.replace(/\/$/, "");
      callback(null, !origin || origins.has(normalized ?? ""));
    },
  });
  app.setGlobalPrefix(configString(config, "API_PREFIX"));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationAppError,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();
  return app;
}

export function createOpenApiDocument(
  app: INestApplication,
): ReturnType<typeof SwaggerModule.createDocument> {
  const config = new DocumentBuilder()
    .setTitle("API Template")
    .setDescription(
      "NestJS API template with JWE authentication, rotating refresh sessions, and RBAC.",
    )
    .setVersion("1.0.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWE" })
    .build();
  return SwaggerModule.createDocument(app, config, {
    extraModels: [ProblemDetailsDto],
  });
}

export function setupSwagger(app: NestFastifyApplication): void {
  const document = createOpenApiDocument(app);
  app.getHttpAdapter().get("/docs/openapi.json", (_request, reply) => {
    reply.type("application/json").send(document);
  });
}
