import {
  createGetEnvVarFromShell,
  createGetTypedEnvVarFromEnv,
  env,
  getEnvVarFromEnv,
  IS_CI,
  type CustomVariableConfig,
} from "./env/utils.mts";

// #region Pipeline environment variables.
export function getPipelineEnvVars<TVarNames extends readonly (keyof EnvVarsMap)[]>(
  ...varNames: TVarNames
): PipelineEnvVarsRecord<TVarNames[number]> {
  const record: Record<string, unknown> = {};

  for (const name of varNames) {
    record[name] = ENV_VARS_MAP[name];
  }

  return record as PipelineEnvVarsRecord<TVarNames[number]>;
}

type PipelineEnvVarsRecord<TVarNames extends keyof EnvVarsMap> = {
  [key in TVarNames]: EnvVarsMap[key];
};
// #endregion

// #region Environment variable declarations.
const ENV_VAR_DECLARATIONS = [
  "CI_PIPELINE_IID",
  {
    name: "CI_COMMIT_REF_NAME",
    local: createGetEnvVarFromShell(`git rev-parse --abbrev-ref HEAD`),
    pipeline: getEnvVarFromEnv,
  },

  // Merge request specific variables.
  {
    name: "CI_MERGE_REQUEST_APPROVED",
    local: async () => false,
    pipeline: createGetTypedEnvVarFromEnv("boolean"),
  },
  "CI_MERGE_REQUEST_IID",
] as const satisfies Variable<string>[];

type Variable<TName extends string> = TName | CustomVariableConfig<TName, any>;

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
    const typedConfig = config as CustomVariableConfig<string, any>;

    obj[config.name] = () => typedConfig[variant](config);
  }

  return obj as EnvVarsMap;
})();

/**
 * A map of the environment variable names to the type.
 */
type EnvVarsMap = {
  [key in keyof EnvVarsDeclarationsMap]: EnvVarsDeclarationsMap[key] extends string
    ? string
    : EnvVarsDeclarationsMap[key] extends CustomVariableConfig<string, infer R>
      ? () => Promise<R>
      : never;
};

/**
 * Extract the result type from a CustomVariableConfig.
 */
type ExtractCustomVariableResult<T> = T extends CustomVariableConfig<string, infer R> ? R : never;

/**
 * A map of the environment variable names to the metadata. This is a conversion of the {@link ENV_VAR_DECLARATIONS}
 * array to an object.
 */
type EnvVarsDeclarationsMap = ArrayToObject<typeof ENV_VAR_DECLARATIONS>;

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
// #endregion
