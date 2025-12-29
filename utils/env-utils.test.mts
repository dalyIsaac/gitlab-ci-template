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
});

describe("getEnvVarFromConfigName", () => {
  it("should return the value from environment using config name", async () => {
    // Given
    vi.stubEnv("CFG_VAR", "cfg_value");
    const cfg: VariableConfig<"CFG_VAR", string> = {
      name: "CFG_VAR",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };

    // When
    const result = getEnvVarFromConfigName(cfg);

    // Then
    await expect(result).resolves.toBe("cfg_value");
  });

  it("should throw when the env variable is undefined", async () => {
    // Given
    const cfg: VariableConfig<"MISSING", string> = {
      name: "MISSING",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };

    // When
    const result = getEnvVarFromConfigName(cfg);

    // Then
    await expect(result).rejects.toThrow(/Environment variable "MISSING" is not defined./);
  });
});

describe("createGetTypedEnvVarFromEnv", () => {
  it("should get string value from env", async () => {
    // Given
    vi.stubEnv("STR_VAR", "hello");
    const getTyped = createGetTypedEnvVarFromEnv("string");
    const cfg: VariableConfig<"STR_VAR", string> = {
      name: "STR_VAR",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };

    // When
    const result = getTyped(cfg);

    // Then
    await expect(result).resolves.toBe("hello");
  });

  it("should cast number value", async () => {
    // Given
    vi.stubEnv("NUM_VAR", "42");
    const getTyped = createGetTypedEnvVarFromEnv("number");
    const cfg: VariableConfig<"NUM_VAR", number> = {
      name: "NUM_VAR",
      local: async () => 0,
      pipeline: async () => 0,
    };

    // When
    const result = getTyped(cfg);

    // Then
    await expect(result).resolves.toBe(42);
  });

  it("should cast boolean value (case-insensitive)", async () => {
    // Given
    vi.stubEnv("BOOL_VAR", "TRUE");
    const getTyped = createGetTypedEnvVarFromEnv("boolean");
    const cfg: VariableConfig<"BOOL_VAR", boolean> = {
      name: "BOOL_VAR",
      local: async () => false,
      pipeline: async () => false,
    };

    // When
    const result = getTyped(cfg);

    // Then
    await expect(result).resolves.toBe(true);
  });

  it("should throw when env var is missing", async () => {
    // Given
    const getTyped = createGetTypedEnvVarFromEnv("string");
    const cfg: VariableConfig<"MISSING_TYPED", string> = {
      name: "MISSING_TYPED",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };

    // When
    const result = getTyped(cfg);

    // Then
    await expect(result).rejects.toThrow(/Environment variable "MISSING_TYPED" is not defined./);
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
