import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { validateEnvironment } from "./common/config/environment";
import { AccessTokenGuard } from "./common/guards/access-token.guard";
import { PermissionGuard } from "./common/guards/permission.guard";
import { DatabaseModule } from "./database/database.module";
import { AccessControlModule } from "./modules/access-control/access-control.module";
import { AccountModule } from "./modules/auth/account.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    AccountModule,
    AccessControlModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
