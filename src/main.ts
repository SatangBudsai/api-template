import { ConfigService } from "@nestjs/config";

import { createApplication, setupSwagger } from "./bootstrap";
import { configNumber } from "./common/config/config-values";

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  setupSwagger(app);
  const config = app.get(ConfigService);
  await app.listen({ port: configNumber(config, "PORT"), host: "0.0.0.0" });
}

void bootstrap();
