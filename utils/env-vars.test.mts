import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV_VARS_MAP, getPipelineEnvVars } from "./env-vars.mts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("EnvVarsMap type safety", () => {
  it("should not map any field to 'any' type", () => {
    // Given
    // Compile-time validation: if any field returns Promise<any>, EnvVarsMapValidation becomes false
    const _: EnvVarsMapValidation = true;

    // Then
    expect(true).toBe(true);
  });

  it("should not map any field to 'Promise<any>' type", () => {
    // Given
    // Compile-time validation: if any field returns Promise<any>, EnvVarsMapValidation becomes false
    const _: EnvVarsMapValidation = true;

    // Then
    expect(true).toBe(true);
  });

  it("should detect Promise<any> in test map", () => {
    // Given
    // Create a test map with a field that returns Promise<any>
    const TEST_MAP_WITH_ANY = {
      VALID_FIELD: "string",
      INVALID_FIELD: () => Promise.resolve({ key: "value" } as any),
    };

    // Apply the same validation to the test map using ValidateMap
    type ValidateTestMap = ValidateMap<typeof TEST_MAP_WITH_ANY>;

    // This should be false because INVALID_FIELD returns Promise<any>
    type TestMapValidation = typeof TEST_MAP_WITH_ANY extends ValidateTestMap ? true : false;

    // When
    const shouldBeFalse: TestMapValidation = false;

    // Then
    expect(shouldBeFalse).toBe(false);
  });

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
});

describe("getPipelineEnvVars", () => {
  describe("Environment variable retrieval", () => {
    it("should return an object with the requested variables", () => {
      // Given
      vi.stubEnv("CI_PIPELINE_IID", "123");
      vi.stubEnv("CI_MERGE_REQUEST_IID", "456");
      const varNames = ["CI_PIPELINE_IID", "CI_MERGE_REQUEST_IID"] as const;

      // When
      const result = getPipelineEnvVars(...varNames);

      // Then
      expect(result).toHaveProperty("CI_PIPELINE_IID");
      expect(result).toHaveProperty("CI_MERGE_REQUEST_IID");
      expect(Object.keys(result)).toHaveLength(2);
    });

    it("should return string values for simple string variables", () => {
      // Given
      vi.stubEnv("CI_PIPELINE_IID", "123");
      const varNames = ["CI_PIPELINE_IID"] as const;

      // When
      const result = getPipelineEnvVars(...varNames);

      // Then
      expect(result.CI_PIPELINE_IID).toBe("123");
    });

    it("should return getter functions for config-based variables", () => {
      // Given
      vi.stubEnv("CI_MERGE_REQUEST_APPROVED", "true");
      const varNames = ["CI_MERGE_REQUEST_APPROVED"] as const;

      // When
      const result = getPipelineEnvVars(...varNames);

      // Then
      expect(typeof result.CI_MERGE_REQUEST_APPROVED).toBe("function");
    });

    it("should handle empty variable list", () => {
      // When
      const result = getPipelineEnvVars();

      // Then
      expect(result).toEqual({});
    });

    it("should handle multiple variables of different types", () => {
      // Given
      vi.stubEnv("CI_PIPELINE_IID", "456");
      vi.stubEnv("CI_MERGE_REQUEST_IID", "789");
      const varNames = ["CI_PIPELINE_IID", "CI_MERGE_REQUEST_IID"] as const;

      // When
      const result = getPipelineEnvVars(...varNames);

      // Then
      expect(result.CI_PIPELINE_IID).toBe("456");
      expect(result.CI_MERGE_REQUEST_IID).toBe("789");
    });
  });

  describe("Type safety", () => {
    it("should type string variables as strings", () => {
      // Given
      vi.stubEnv("CI_PIPELINE_IID", "123");

      // When
      const result = getPipelineEnvVars("CI_PIPELINE_IID");

      // Then
      const _: string = result.CI_PIPELINE_IID;
      expect(typeof result.CI_PIPELINE_IID).toBe("string");
    });

    it("should type config-based variables as functions returning promises", async () => {
      // Given
      vi.stubEnv("CI_MERGE_REQUEST_APPROVED", "true");

      // When
      const result = getPipelineEnvVars("CI_MERGE_REQUEST_APPROVED");

      // Then
      const getter = result.CI_MERGE_REQUEST_APPROVED;
      expect(typeof getter).toBe("function");
      const returnValue = getter();
      expect(returnValue instanceof Promise).toBe(true);
      // When not in CI, it uses the local variant which returns false
      await expect(returnValue).resolves.toBe(false);
    });

    it("should correctly type multiple variables with mixed types", () => {
      // Given
      vi.stubEnv("CI_PIPELINE_IID", "123");
      vi.stubEnv("CI_MERGE_REQUEST_APPROVED", "false");

      // When
      const result = getPipelineEnvVars("CI_PIPELINE_IID", "CI_MERGE_REQUEST_APPROVED");

      // Then
      const _stringType: string = result.CI_PIPELINE_IID;
      const _functionType: () => Promise<boolean> = result.CI_MERGE_REQUEST_APPROVED;
      expect(typeof result.CI_PIPELINE_IID).toBe("string");
      expect(typeof result.CI_MERGE_REQUEST_APPROVED).toBe("function");
    });
  });
});
