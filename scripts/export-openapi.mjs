import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createApplication,
  createOpenApiDocument,
} from "../dist/src/bootstrap.js";

const outputDirectory = resolve("openapi");
const outputFile = resolve(outputDirectory, "api-template.swagger.json");
const app = await createApplication({ logger: false });

try {
  await app.init();
  const document = createOpenApiDocument(app);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  process.stdout.write(`OpenAPI written to ${outputFile}\n`);
} finally {
  await app.close();
}
