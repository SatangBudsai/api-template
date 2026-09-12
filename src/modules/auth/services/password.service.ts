import { Injectable } from "@nestjs/common";
import { hash, verify, argon2id } from "argon2";

const ARGON_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return hash(password, ARGON_OPTIONS);
  }

  verify(hashValue: string, password: string): Promise<boolean> {
    return verify(hashValue, password);
  }
}
