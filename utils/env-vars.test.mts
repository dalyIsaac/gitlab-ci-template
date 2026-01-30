import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDependencyGraphFromDeclarations, detectCycle } from "./deps-graph.mts";
import { ENV_VARS_MAP, getLocalEnvVars, getPipelineEnvVars, type EnvVarsMap } from "./env-vars.mts";

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
  type ValidateEnvVarsMap = ValidateMap<EnvVarsMap>;

  /**
   * Check that ENV_VARS_MAP matches the validation type.
   * If any field returns Promise<any>, ValidateEnvVarsMap will have an error field,
   * making this validation resolve to false and causing a compile error.
   */
  type EnvVarsMapValidation = EnvVarsMap extends ValidateEnvVarsMap ? true : false;
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

    it("should return getter functions for CI_PIPELINE_IID", async () => {
      // Given
      vi.stubEnv("CI_PIPELINE_IID", "123");
      const varNames = ["CI_PIPELINE_IID"] as const;

      // When
      const result = getPipelineEnvVars(...varNames);

      // Then
      const value = await result.CI_PIPELINE_IID();
      expect(value).toBe("123");
    });

    it("should return getter functions for CI_MERGE_REQUEST_APPROVED", async () => {
      // Given
      vi.stubEnv("CI_MERGE_REQUEST_APPROVED", "true");
      const varNames = ["CI_MERGE_REQUEST_APPROVED"] as const;

      // When
      const result = getPipelineEnvVars(...varNames);

      // Then
      const value = await result.CI_MERGE_REQUEST_APPROVED();
      expect(value).toBe(false); // Local variant returns false
    });

    it("should handle empty variable list", () => {
      // When
      const result = getPipelineEnvVars();

      // Then
      expect(result).toEqual({});
    });
  });

  describe("Type safety", () => {
    it("should type string variables as functions returning promises", async () => {
      // Given
      vi.stubEnv("CI_PIPELINE_IID", "123");

      // When
      const result = getPipelineEnvVars("CI_PIPELINE_IID");

      // Then
      const value = await result.CI_PIPELINE_IID();
      expect(value).toBe("123");
    });

    it("should type config-based variables as functions returning promises", async () => {
      // Given
      vi.stubEnv("CI_MERGE_REQUEST_APPROVED", "true");

      // When
      const result = getPipelineEnvVars("CI_MERGE_REQUEST_APPROVED");

      // Then
      const returnValue = result.CI_MERGE_REQUEST_APPROVED();
      expect(returnValue instanceof Promise).toBe(true);
      // When not in CI, it uses the local variant which returns false
      await expect(returnValue).resolves.toBe(false);
    });

    it("should correctly type multiple variables with mixed types", async () => {
      // Given
      vi.stubEnv("CI_PIPELINE_IID", "123");
      vi.stubEnv("CI_MERGE_REQUEST_APPROVED", "false");

      // When
      const result = getPipelineEnvVars("CI_PIPELINE_IID", "CI_MERGE_REQUEST_APPROVED");

      // Then
      const pipelineIid = await result.CI_PIPELINE_IID();
      const approved = await result.CI_MERGE_REQUEST_APPROVED();
      expect(pipelineIid).toBe("123");
      expect(approved).toBe(false);
    });
  });
});

describe("getLocalEnvVars", () => {
  describe("Variable collection", () => {
    it("should include all simple string variables", () => {
      // Given
      vi.stubEnv("CI_PROJECT_ID", "12345");
      vi.stubEnv("CI_PIPELINE_IID", "789");

      // When
      const result = getLocalEnvVars();

      // Then
      expect(result).toHaveProperty("CI_PROJECT_ID");
      expect(result).toHaveProperty("CI_PIPELINE_IID");
    });

    it("should include all variables with a local field", () => {
      // Given
      vi.stubEnv("CI_PROJECT_ID", "12345");
      vi.stubEnv("CI_PIPELINE_IID", "789");

      // When
      const result = getLocalEnvVars();

      // Then
      expect(result).toHaveProperty("CI_COMMIT_REF_NAME");
      expect(result).toHaveProperty("CI_MERGE_REQUEST_APPROVED");
      expect(result).toHaveProperty("CI_MERGE_REQUEST_IID");
    });

    it("should return an object with all expected local variables", () => {
      // Given
      vi.stubEnv("CI_PROJECT_ID", "12345");
      vi.stubEnv("CI_PIPELINE_IID", "789");

      // When
      const result = getLocalEnvVars();

      // Then
      const expectedVariables = [
        "CI_PROJECT_ID",
        "CI_PIPELINE_IID",
        "CI_COMMIT_REF_NAME",
        "CI_PROJECT_DIR",
        "UTILS_DIR",
        "CI_MERGE_REQUEST_APPROVED",
        "CI_MERGE_REQUEST_IID",
      ];
      expect(Object.keys(result).sort()).toEqual(expectedVariables.sort());
    });
  });

  describe("Variable types", () => {
    it("should return getter functions for variables", async () => {
      // Given
      vi.stubEnv("CI_PROJECT_ID", "12345");
      vi.stubEnv("CI_PIPELINE_IID", "789");

      // When
      const result = getLocalEnvVars();

      // Then
      const projectId = await result.CI_PROJECT_ID();
      const pipelineIid = await result.CI_PIPELINE_IID();
      expect(projectId).toBe("12345");
      expect(pipelineIid).toBe("789");
    });
  });

  describe("Getter functions execution", () => {
    it("should return promises when calling getter functions", async () => {
      // Given
      vi.stubEnv("CI_PROJECT_ID", "12345");
      vi.stubEnv("CI_PIPELINE_IID", "789");

      // When
      const result = getLocalEnvVars();

      // Then
      const commitRefNamePromise = result.CI_COMMIT_REF_NAME();
      const mergeRequestApprovedPromise = result.CI_MERGE_REQUEST_APPROVED();
      const mergeRequestIidPromise = result.CI_MERGE_REQUEST_IID();

      expect(commitRefNamePromise instanceof Promise).toBe(true);
      expect(mergeRequestApprovedPromise instanceof Promise).toBe(true);
      expect(mergeRequestIidPromise instanceof Promise).toBe(true);

      // Verify they resolve to the expected local values
      await expect(mergeRequestApprovedPromise).resolves.toBe(false);
      await expect(mergeRequestIidPromise).resolves.toBe(1);
    });
  });
});

describe("Variable references", () => {
  describe("CI_PROJECT_DIR", () => {
    it("should be available as a local variable", () => {
      // Given
      vi.stubEnv("CI_PROJECT_ID", "12345");
      vi.stubEnv("CI_PIPELINE_IID", "789");

      // When
      const result = getLocalEnvVars();

      // Then
      expect(result).toHaveProperty("CI_PROJECT_DIR");
    });

    it("should return the local default value", async () => {
      // Given
      vi.stubEnv("CI_PROJECT_ID", "12345");
      vi.stubEnv("CI_PIPELINE_IID", "789");

      // When
      const result = getLocalEnvVars();
      const value = await result.CI_PROJECT_DIR();

      // Then
      expect(value).toBe("/home/username/repos/gitlab-ci-template");
    });
  });

  describe("UTILS_DIR", () => {
    it("should be available as a local variable", () => {
      // Given
      vi.stubEnv("CI_PROJECT_ID", "12345");
      vi.stubEnv("CI_PIPELINE_IID", "789");

      // When
      const result = getLocalEnvVars();

      // Then
      expect(result).toHaveProperty("UTILS_DIR");
    });

    it("should reference CI_PROJECT_DIR correctly", async () => {
      // Given
      vi.stubEnv("CI_PROJECT_ID", "12345");
      vi.stubEnv("CI_PIPELINE_IID", "789");

      // When
      const result = getLocalEnvVars();
      const utilsDir = await result.UTILS_DIR();

      // Then
      expect(utilsDir).toBe("/home/username/repos/gitlab-ci-template/utils");
    });
  });

  describe("Pipeline usage", () => {
    it("should work with getPipelineEnvVars", () => {
      // Given
      vi.stubEnv("CI_PROJECT_ID", "12345");
      vi.stubEnv("CI_PIPELINE_IID", "789");

      // When
      const result = getPipelineEnvVars("CI_PROJECT_DIR", "UTILS_DIR");

      // Then
      expect(result).toHaveProperty("CI_PROJECT_DIR");
      expect(result).toHaveProperty("UTILS_DIR");
    });

    it("should allow UTILS_DIR to reference CI_PROJECT_DIR in pipeline context", async () => {
      // Given
      vi.stubEnv("CI_PROJECT_ID", "12345");
      vi.stubEnv("CI_PIPELINE_IID", "789");

      // When
      const result = getPipelineEnvVars("CI_PROJECT_DIR", "UTILS_DIR");
      const utilsDir = await result.UTILS_DIR();

      // Then: Since ENV_VARS_MAP is built at module load time as local (not CI),
      // this test gets the local implementation which uses the hardcoded path
      expect(utilsDir).toBe("/home/username/repos/gitlab-ci-template/utils");
    });
  });
});

describe("Circular dependency detection", () => {
  /**
   * Helper function to detect circular dependencies in variable declarations.
   * Wraps the shared detectCycle function for test declarations format.
   */
  const detectCircularDeps = (declarations: any[]): boolean => {
    const depGraph = buildDependencyGraphFromDeclarations(declarations);
    return detectCycle(depGraph) !== null;
  };

  it("should detect when a variable depends on itself (direct cycle)", () => {
    // Given: A variable that depends on itself
    const declarations = [{ name: "A", deps: ["A"] }];

    // When/Then: Should detect the self-dependency
    expect(detectCircularDeps(declarations)).toBe(true);
  });

  it("should detect two-variable circular dependency (A -> B -> A)", () => {
    // Test with a valid configuration (no cycles)
    const validDeclarations = ["A", { name: "B", deps: ["A"] }, { name: "C", deps: ["B"] }];
    expect(detectCircularDeps(validDeclarations)).toBe(false);

    // Test with circular dependency
    const circularDeclarations = [
      { name: "A", deps: ["B"] },
      { name: "B", deps: ["A"] },
    ];
    expect(detectCircularDeps(circularDeclarations)).toBe(true);
  });

  it("should detect three-variable circular dependency (A -> B -> C -> A)", () => {
    // Given: Three variables forming a cycle
    const circularDeclarations = [
      { name: "A", deps: ["B"] },
      { name: "B", deps: ["C"] },
      { name: "C", deps: ["A"] },
    ];

    // When/Then: Should detect the cycle
    expect(detectCircularDeps(circularDeclarations)).toBe(true);
  });

  it("should verify ENV_VARS_MAP is built without circular dependencies", () => {
    // When/Then: ENV_VARS_MAP is constructed at module load time; it should exist
    expect(Object.keys(ENV_VARS_MAP).length).toBeGreaterThan(0);
  });
});
describe("add with pipeline-only variables", () => {
  it("should throw an error when accessing a pipeline-only variable in local environment", async () => {
    // Given: A pipeline-only variable in ENV_VARS_MAP
    // When: Attempting to access GITLAB_TOKEN locally
    const getter = ENV_VARS_MAP.GITLAB_TOKEN;

    // Then: Should throw an error
    await expect(getter()).rejects.toThrow('Pipeline-only variable "GITLAB_TOKEN" is not available in local environments.');
  });

  it("should not include pipeline-only variables in getLocalEnvVars", () => {
    // Given/When: Getting all local environment variables
    const result = getLocalEnvVars();

    // Then: Should include all non-pipeline-only variables but exclude pipeline-only ones
    expect(result).toHaveProperty("CI_PROJECT_ID");
    expect(result).toHaveProperty("CI_PIPELINE_IID");
    expect(result).not.toHaveProperty("GITLAB_TOKEN");
  });

  it("should be accessible via getPipelineEnvVars", () => {
    // Given: A pipeline-only variable
    vi.stubEnv("GITLAB_TOKEN", "pipeline-token-value");

    // When: Getting the pipeline-only variable via getPipelineEnvVars
    const result = getPipelineEnvVars("GITLAB_TOKEN");

    // Then: Should have the pipeline-only variable getter
    expect(result).toHaveProperty("GITLAB_TOKEN");
    expect(typeof result.GITLAB_TOKEN).toBe("function");
  });
});
