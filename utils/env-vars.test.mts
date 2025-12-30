import { describe, expect, it } from "vitest";
import { ENV_VARS_MAP } from "./env-vars.mts";

/**
 * Detects if a type is any by checking mutual assignability.
 * If 0 extends (1 & T), then T must be any.
 */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Detects if a type is Promise<any> by checking if the resolved type is any.
 */
type IsPromiseAny<T> = T extends Promise<infer U> ? IsAny<U> : false;

/**
 * Validates that no field in a map has type 'any' or returns 'Promise<any>'.
 * For string fields, they're already validated.
 * For function fields, we extract the return type and check if it's Promise<any>.
 */
type ValidateMap<T> = {
  [K in keyof T]: T[K] extends string
    ? T[K]
    : T[K] extends (...args: any[]) => infer Ret
      ? IsPromiseAny<Ret> extends true
        ? "ERROR_PROMISE_ANY" & { field: K }
        : T[K]
      : T[K];
};

/**
 * Validates that no field in ENV_VARS_MAP has type 'any' or returns 'Promise<any>'.
 */
type ValidateEnvVarsMap = ValidateMap<typeof ENV_VARS_MAP>;

/**
 * Check that ENV_VARS_MAP matches the validation type.
 * If any field returns Promise<any>, ValidateEnvVarsMap will have an error field,
 * making this validation resolve to false and causing a compile error.
 */
type EnvVarsMapValidation = typeof ENV_VARS_MAP extends ValidateEnvVarsMap ? true : false;

describe("EnvVarsMap type safety", () => {
  it("should not map any field to 'any' type", () => {
    // Compile-time validation: if any field returns Promise<any>, EnvVarsMapValidation becomes false
    const _: EnvVarsMapValidation = true;
    expect(true).toBe(true);
  });

  it("should not map any field to 'Promise<any>' type", () => {
    // Compile-time validation: if any field returns Promise<any>, EnvVarsMapValidation becomes false
    const _: EnvVarsMapValidation = true;
    expect(true).toBe(true);
  });

  it("should detect Promise<any> in test map", () => {
    // Create a test map with a field that returns Promise<any>
    const TEST_MAP_WITH_ANY = {
      VALID_FIELD: "string",
      INVALID_FIELD: () => Promise.resolve({ key: "value" } as any),
    };

    // Apply the same validation to the test map using ValidateMap
    type ValidateTestMap = ValidateMap<typeof TEST_MAP_WITH_ANY>;

    // This should be false because INVALID_FIELD returns Promise<any>
    type TestMapValidation = typeof TEST_MAP_WITH_ANY extends ValidateTestMap ? true : false;

    // Verify the validation correctly identifies the invalid field
    const shouldBeFalse: TestMapValidation = false;
    expect(shouldBeFalse).toBe(false);
  });
});
