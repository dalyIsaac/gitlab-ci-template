import { afterEach, describe, expect, it, vi } from "vitest";
import { createGetTypedEnvVarFromEnv, env, getEnvVarFromConfigName, type VariableConfig } from "./env-utils.mts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env", () => {
  it("should return the value of a defined environment variable", () => {
    // Given
    vi.stubEnv("TEST_VAR", "test_value");

    // When
    const result = env("TEST_VAR");

    // Then
    expect(result).toBe("test_value");
  });

  it("should throw an error for an undefined environment variable", () => {
    // When/Then
    expect(() => env("UNDEFINED_VAR")).toThrowError(/Environment variable \"UNDEFINED_VAR\" is not defined./);
  });

  it("should return fallback value when env variable is undefined", () => {
    // Given
    vi.stubEnv("UNDEFINED_WITH_FALLBACK", undefined);

    // When
    const result = env("UNDEFINED_WITH_FALLBACK", "fallback_value");

    // Then
    expect(result).toBe("fallback_value");
  });

  it("should prefer env value over fallback", () => {
    // Given
    vi.stubEnv("DEFINED_VAR", "actual_value");

    // When
    const result = env("DEFINED_VAR", "fallback_value");

    // Then
    expect(result).toBe("actual_value");
  });
});

describe("getEnvVarFromConfigName", () => {
  it("should return the value from environment using config name", async () => {
    // Given
    vi.stubEnv("CFG_VAR", "cfg_value");
    const cfg: VariableConfig<"CFG_VAR", string, []> = {
      name: "CFG_VAR",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };

    // When
    const result = getEnvVarFromConfigName({ config: cfg, env: {} });

    // Then
    await expect(result).resolves.toBe("cfg_value");
  });

  it("should throw when the env variable is undefined", async () => {
    // Given
    const cfg: VariableConfig<"MISSING", string, []> = {
      name: "MISSING",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };

    // When
    const result = getEnvVarFromConfigName({ config: cfg, env: {} });

    // Then
    await expect(result).rejects.toThrow(/Environment variable "MISSING" is not defined./);
  });

  it("should use fallback value when env variable is undefined", async () => {
    // Given
    vi.stubEnv("WITH_FALLBACK", undefined);
    const cfg: VariableConfig<"WITH_FALLBACK", string, []> = {
      name: "WITH_FALLBACK",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };

    // When
    const result = getEnvVarFromConfigName({ config: cfg, env: {} }, "fallback_value");

    // Then
    await expect(result).resolves.toBe("fallback_value");
  });

  it("should prefer env variable over fallback value", async () => {
    // Given
    vi.stubEnv("OVERRIDE_VAR", "env_value");
    const cfg: VariableConfig<"OVERRIDE_VAR", string, []> = {
      name: "OVERRIDE_VAR",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };

    // When
    const result = getEnvVarFromConfigName({ config: cfg, env: {} }, "fallback_value");

    // Then
    await expect(result).resolves.toBe("env_value");
  });
});

describe("createGetTypedEnvVarFromEnv", () => {
  it("should get string value from env", async () => {
    // Given
    vi.stubEnv("STR_VAR", "hello");
    const getTyped = createGetTypedEnvVarFromEnv("string");
    const cfg: VariableConfig<"STR_VAR", string, []> = {
      name: "STR_VAR",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };

    // When
    const result = getTyped({ config: cfg, env: {} });

    // Then
    await expect(result).resolves.toBe("hello");
  });

  it("should cast number value", async () => {
    // Given
    vi.stubEnv("NUM_VAR", "42");
    const getTyped = createGetTypedEnvVarFromEnv("number");
    const cfg: VariableConfig<"NUM_VAR", number, []> = {
      name: "NUM_VAR",
      local: async () => 0,
      pipeline: async () => 0,
    };

    // When
    const result = getTyped({ config: cfg, env: {} });

    // Then
    await expect(result).resolves.toBe(42);
  });

  it("should cast boolean value (case-insensitive)", async () => {
    // Given
    vi.stubEnv("BOOL_VAR", "TRUE");
    const getTyped = createGetTypedEnvVarFromEnv("boolean");
    const cfg: VariableConfig<"BOOL_VAR", boolean, []> = {
      name: "BOOL_VAR",
      local: async () => false,
      pipeline: async () => false,
    };

    // When
    const result = getTyped({ config: cfg, env: {} });

    // Then
    await expect(result).resolves.toBe(true);
  });

  it("should throw when env var is missing", async () => {
    // Given
    const getTyped = createGetTypedEnvVarFromEnv("string");
    const cfg: VariableConfig<"MISSING_TYPED", string, []> = {
      name: "MISSING_TYPED",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };

    // When
    const result = getTyped({ config: cfg, env: {} });

    // Then
    await expect(result).rejects.toThrow(/Environment variable "MISSING_TYPED" is not defined./);
  });

  it("should use fallback string value when env var is missing", async () => {
    // Given
    vi.stubEnv("FALLBACK_STR", undefined);
    const getTyped = createGetTypedEnvVarFromEnv("string", "fallback_string");
    const cfg: VariableConfig<"FALLBACK_STR", string, []> = {
      name: "FALLBACK_STR",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };

    // When
    const result = getTyped({ config: cfg, env: {} });

    // Then
    await expect(result).resolves.toBe("fallback_string");
  });

  it("should cast fallback number value", async () => {
    // Given
    vi.stubEnv("FALLBACK_NUM", undefined);
    const getTyped = createGetTypedEnvVarFromEnv("number", "100");
    const cfg: VariableConfig<"FALLBACK_NUM", number, []> = {
      name: "FALLBACK_NUM",
      local: async () => 0,
      pipeline: async () => 0,
    };

    // When
    const result = getTyped({ config: cfg, env: {} });

    // Then
    await expect(result).resolves.toBe(100);
  });

  it("should cast fallback boolean value", async () => {
    // Given
    vi.stubEnv("FALLBACK_BOOL", undefined);
    const getTyped = createGetTypedEnvVarFromEnv("boolean", "false");
    const cfg: VariableConfig<"FALLBACK_BOOL", boolean, []> = {
      name: "FALLBACK_BOOL",
      local: async () => true,
      pipeline: async () => true,
    };

    // When
    const result = getTyped({ config: cfg, env: {} });

    // Then
    await expect(result).resolves.toBe(false);
  });

  it("should prefer env value over fallback for typed values", async () => {
    // Given
    vi.stubEnv("OVERRIDE_NUM", "999");
    const getTyped = createGetTypedEnvVarFromEnv("number", "100");
    const cfg: VariableConfig<"OVERRIDE_NUM", number, []> = {
      name: "OVERRIDE_NUM",
      local: async () => 0,
      pipeline: async () => 0,
    };

    // When
    const result = getTyped({ config: cfg, env: {} });

    // Then
    await expect(result).resolves.toBe(999);
  });
});

describe("IS_CI", () => {
  it("should be true when GITLAB_CI is true", async () => {
    // Given
    vi.resetModules();
    vi.stubEnv("GITLAB_CI", "true");

    // When
    const mod = await import("./env-utils.mts");

    // Then
    expect(mod.IS_CI).toBe(true);
  });

  it("should be false when GITLAB_CI is false", async () => {
    // Given
    vi.resetModules();
    vi.stubEnv("GITLAB_CI", "false");

    // When
    const mod = await import("./env-utils.mts");

    // Then
    expect(mod.IS_CI).toBe(false);
  });
});
