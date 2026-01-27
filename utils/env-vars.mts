import { $ } from "zx";
import { createGetTypedEnvVarFromEnv, env, getEnvVarFromConfigName, IS_CI, type VariableConfig } from "./env-utils.mts";

/**
 * The declarations for all environment variables used in the pipeline.
 * Each declaration can be a simple string (the variable name) or a {@link VariableConfig}.
 */
const ENV_VAR_DECLARATIONS = [
  "CI_PROJECT_ID",
  "CI_PIPELINE_IID",
  {
    name: "CI_COMMIT_REF_NAME",
    local: async () => {
      const output = await $`git rev-parse --abbrev-ref HEAD`;
      return output.valueOf();
    },
    pipeline: getEnvVarFromConfigName,
  },
  {
    name: "CI_PROJECT_DIR",
    local: async () => "/home/username/repos/gitlab-ci-template",
    pipeline: getEnvVarFromConfigName,
  },
  ({
    name: "UTILS_DIR",
    deps: ["CI_PROJECT_DIR"] as const,
    local: async (config, env) => {
      const ciProjectDir = env.CI_PROJECT_DIR;
      const projectDir = typeof ciProjectDir === "function" ? await ciProjectDir() : ciProjectDir;
      return `${projectDir}/utils`;
    },
    pipeline: async (config, env) => {
      const ciProjectDir = env.CI_PROJECT_DIR;
      const projectDir = typeof ciProjectDir === "function" ? await ciProjectDir() : ciProjectDir;
      return `${projectDir}/utils`;
    },
  } as const satisfies VariableConfig<"UTILS_DIR", string, readonly ["CI_PROJECT_DIR"], { CI_PROJECT_DIR: () => Promise<string> }>),

  // Merge request specific variables.
  {
    name: "CI_MERGE_REQUEST_APPROVED",
    local: async () => false,
    pipeline: createGetTypedEnvVarFromEnv("boolean"),
  },
  {
    name: "CI_MERGE_REQUEST_IID",
    local: async () => 1,
    pipeline: createGetTypedEnvVarFromEnv("number"),
  },
] as const satisfies Variable<string>[];

/**
 * Type for variable declarations - either a simple string or a VariableConfig.
 */
type Variable<TName extends string> = TName | VariableConfig<TName, any, any, any>;

/**
 * A map of {@link ENV_VAR_DECLARATIONS} names to the values or getter functions.
 */
export const ENV_VARS_MAP = (() => {
  const obj: Partial<EnvVarsMap> = {};

  for (const config of ENV_VAR_DECLARATIONS) {
    // Simple string variable.
    if (typeof config === "string") {
      // Create a getter which always returns the env var.
      Object.defineProperty(obj, config, {
        get: () => env(config),
      });
      continue;
    }

    const variant = IS_CI ? "pipeline" : "local";

    // Cast to ignore ENV_VAR_DECLARATIONS being a readonly tuple.
    const typedConfig = config as VariableConfig<string, any, any>;

    obj[config.name] = () => {
      // Build the env object with only the declared dependencies
      const envObj: any = {};
      if (typedConfig.deps) {
        for (const dep of typedConfig.deps) {
          envObj[dep] = obj[dep as keyof typeof obj];
        }
      }
      return typedConfig[variant](config, envObj);
    };
  }

  return obj as EnvVarsMap;
})();

/**
 * Gets all the variables specified in {@link varNames} from the pipeline environment.
 *
 * @param varNames The names of the environment variables to get.
 * @returns An object mapping the variable names to their values or getters.
 */
export function getPipelineEnvVars<TVarNames extends readonly (keyof EnvVarsMap)[]>(
  ...varNames: TVarNames
): PipelineEnvVarsRecord<TVarNames[number]> {
  const record: Record<string, unknown> = {};

  for (const name of varNames) {
    record[name] = ENV_VARS_MAP[name];
  }

  return record as PipelineEnvVarsRecord<TVarNames[number]>;
}

/**
 * Gets the local variants of all environment variables defined in {@link ENV_VAR_DECLARATIONS}.
 *
 * @returns An object mapping the variable names to their values or getters.
 */
export function getLocalEnvVars(): PipelineEnvVarsRecord<LocalVarNames> {
  const localVarNames: LocalVarNames[] = [];

  for (const config of ENV_VAR_DECLARATIONS) {
    if (typeof config === "string") {
      // Include simple string variables
      localVarNames.push(config as LocalVarNames);
    } else if ("local" in config) {
      // Include variables with a local field
      localVarNames.push(config.name as LocalVarNames);
    }
  }

  return getPipelineEnvVars(...localVarNames);
}

/**
 * The names of all environment variables that are available locally (either as simple strings or with a `local` field).
 */
type LocalVarNames = keyof EnvVarsDeclarationsMap;

/**
 * A record mapping environment variable names to their types.
 */
type PipelineEnvVarsRecord<TVarNames extends keyof EnvVarsMap> = {
  [key in TVarNames]: EnvVarsMap[key];
};

/**
 * A map of the environment variable names to the type.
 */
export type EnvVarsMap = {
  [key in keyof EnvVarsDeclarationsMap]: EnvVarsDeclarationsMap[key] extends string
    ? string
    : EnvVarsDeclarationsMap[key] extends VariableConfig<string, infer R>
      ? () => Promise<R>
      : never;
};

/**
 * A map of the environment variable names to the metadata. This is a conversion of the {@link ENV_VAR_DECLARATIONS}
 * array to an object.
 */
export type EnvVarsDeclarationsMap = ArrayToObject<typeof ENV_VAR_DECLARATIONS>;

/**
 * Converts an array to an object.
 */
type ArrayToObject<T extends readonly any[]> = {
  [P in T[number] as P extends string
    ? P // If it's a string, use it as the key.
    : P extends { name: infer N }
      ? N extends string
        ? N
        : never // If it has a "name", use the name as the key.
      : never]: P; // The value is the original type from the array.
};

/**
 * Properly typed environment object for custom variable functions.
 * Maps each dependency name to its actual type from EnvVarsMap.
 * This is similar to how PipelineEnvVarsRecord works.
 * 
 * Usage example:
 * ```ts
 * {
 *   name: "UTILS_DIR",
 *   deps: ["CI_PROJECT_DIR"] as const,
 *   local: async (config, env: TypedCustomVariableEnv<["CI_PROJECT_DIR"]>) => {
 *     const dir = env.CI_PROJECT_DIR; // Properly typed as () => Promise<string>
 *     return `${await dir()}/utils`;
 *   },
 *   ...
 * }
 * ```
 */
export type TypedCustomVariableEnv<TDeps extends readonly (keyof EnvVarsDeclarationsMap)[]> = {
  [K in TDeps[number]]: EnvVarsMap[K];
};
