import { afterEach, describe, expect, it, vi } from "vitest";
import { createGetEnvVarFromShell, createGetTypedEnvVarFromEnv, env, getEnvVarFromConfigName, type VariableConfig } from "./env-utils.mts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env", () => {
  it("should return the value of a defined environment variable", () => {
    vi.stubEnv("TEST_VAR", "test_value");
    const result = env("TEST_VAR");
    expect(result).toBe("test_value");
  });

  it("should throw an error for an undefined environment variable", () => {
    expect(() => env("UNDEFINED_VAR")).toThrowError(/Environment variable \"UNDEFINED_VAR\" is not defined./);
  });
});

describe("getEnvVarFromConfigName", () => {
  it("should return the value from environment using config name", async () => {
    vi.stubEnv("CFG_VAR", "cfg_value");
    const cfg: VariableConfig<"CFG_VAR", string> = {
      name: "CFG_VAR",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };
    await expect(getEnvVarFromConfigName(cfg)).resolves.toBe("cfg_value");
  });

  it("should throw when the env variable is undefined", async () => {
    const cfg: VariableConfig<"MISSING", string> = {
      name: "MISSING",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };
    await expect(getEnvVarFromConfigName(cfg)).rejects.toThrow(/Environment variable \"MISSING\" is not defined./);
  });
});

describe("createGetTypedEnvVarFromEnv", () => {
  it("should get string value from env", async () => {
    vi.stubEnv("STR_VAR", "hello");
    const getTyped = createGetTypedEnvVarFromEnv("string");
    const cfg: VariableConfig<"STR_VAR", string> = {
      name: "STR_VAR",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };
    await expect(getTyped(cfg)).resolves.toBe("hello");
  });

  it("should cast number value", async () => {
    vi.stubEnv("NUM_VAR", "42");
    const getTyped = createGetTypedEnvVarFromEnv("number");
    const cfg: VariableConfig<"NUM_VAR", number> = {
      name: "NUM_VAR",
      local: async () => 0,
      pipeline: async () => 0,
    };
    await expect(getTyped(cfg)).resolves.toBe(42);
  });

  it("should cast boolean value (case-insensitive)", async () => {
    vi.stubEnv("BOOL_VAR", "TRUE");
    const getTyped = createGetTypedEnvVarFromEnv("boolean");
    const cfg: VariableConfig<"BOOL_VAR", boolean> = {
      name: "BOOL_VAR",
      local: async () => false,
      pipeline: async () => false,
    };
    await expect(getTyped(cfg)).resolves.toBe(true);
  });

  it("should throw when env var is missing", async () => {
    const getTyped = createGetTypedEnvVarFromEnv("string");
    const cfg: VariableConfig<"MISSING_TYPED", string> = {
      name: "MISSING_TYPED",
      local: async () => "local",
      pipeline: async () => "pipeline",
    };
    await expect(getTyped(cfg)).rejects.toThrow(/Environment variable \"MISSING_TYPED\" is not defined./);
  });
});

describe("createGetEnvVarFromShell", () => {
  it("should execute command and return its output", async () => {
    const getter = createGetEnvVarFromShell("echo hello");
    const result = await getter();
    expect(result.trim()).toBe("hello");
  }, 10000);
});

describe("IS_CI", () => {
  it("should be true when GITLAB_CI is true", async () => {
    vi.resetModules();
    vi.stubEnv("GITLAB_CI", "true");
    const mod = await import("./env-utils.mts");
    expect(mod.IS_CI).toBe(true);
  });

  it("should be false when GITLAB_CI is false", async () => {
    vi.resetModules();
    vi.stubEnv("GITLAB_CI", "false");
    const mod = await import("./env-utils.mts");
    expect(mod.IS_CI).toBe(false);
  });
});
