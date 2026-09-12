import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { hkdfSync } from "node:crypto";

import { configString } from "../../../common/config/config-values";

type KeyPurpose = "jwe" | "csrf" | "session-binding";

const KEYRING_SALT = Buffer.from("api-template:auth-keyring:v1", "utf8");

@Injectable()
export class AuthKeyService {
  private readonly root: Buffer;

  constructor(config: ConfigService) {
    this.root = Buffer.from(
      configString(config, "AUTH_SECRET_BASE64"),
      "base64",
    );
  }

  key(purpose: KeyPurpose): Buffer {
    return Buffer.from(
      hkdfSync("sha256", this.root, KEYRING_SALT, purpose, 32),
    );
  }
}
