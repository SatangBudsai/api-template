declare const errorCodeBrand: unique symbol;

export type ErrorCode = string & { readonly [errorCodeBrand]: true };

const pattern = /^[A-Z][A-Z0-9]*(?:_[A-Z][A-Z0-9]*)+_\d{3}$/;
const registeredCodes = new Set<string>();

export function defineErrorCodes<const T extends Record<string, string>>(
  values: T,
): { readonly [K in keyof T]: ErrorCode } {
  for (const value of Object.values(values)) {
    if (!pattern.test(value)) {
      throw new Error(
        `Invalid error code "${value}". Expected FEATURE_ACTION_NNN.`,
      );
    }
    if (registeredCodes.has(value)) {
      throw new Error(`Duplicate error code "${value}".`);
    }
    registeredCodes.add(value);
  }

  return Object.freeze(values) as unknown as {
    readonly [K in keyof T]: ErrorCode;
  };
}
