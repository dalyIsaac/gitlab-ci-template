// Environment variables
const IS_CI = process.env["GITLAB_CI"] === "true";

export const env = (arg: string): string => "unknown";

// #region Pipeline environment variables.
export function getPipelineEnvVars<TVarNames extends readonly (keyof EnvVarsMap)[]>(
  ...varNames: TVarNames
): PipelineEnvVarsRecord<TVarNames[number]> {
  const record: Partial<EnvVarsMap> = {};

  for (const name of varNames) {
    record[name] = ENV_VARS_MAP[name] as string & (() => Promise<string>);
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
    local: () => Promise.resolve("hello"),
    // ($`git rev-parse --abbrev-ref HEAD`).stdout.trim();
  },
  {
    name: "TEST_PIPELINE",
    local: () => Promise.resolve("TEST_PIPELINE"),
    pipeline: () => Promise.resolve("TEST_PIPELINE"),
  },

  // Merge request specific variables.
  "CI_MERGE_REQUEST_APPROVED",
  "CI_MERGE_REQUEST_IID",
] as const satisfies Variable<string>[];

type Variable<TName extends string> = TName | CustomVariable<TName>;

/**
 * An environment variable which has a custom implementation when running on a local machine.
 */
interface CustomVariable<TName extends string> {
  name: TName;
  local: () => Promise<string>;
  pipeline?: () => Promise<string>;
}

/**
 * A map of {@link ENV_VAR_DECLARATIONS} names to the values or getter functions.
 */
export const ENV_VARS_MAP = (() => {
  const obj: Partial<EnvVarsMap> = {};

  for (const variable of ENV_VAR_DECLARATIONS) {
    if (typeof variable === "string") {
      obj[variable] = env(variable);
      continue;
    }

    if (IS_CI) {
      obj[variable.name] = "pipeline" in variable ? variable.pipeline : () => Promise.resolve(env(variable.name));
      continue;
    }

    obj[variable.name] = variable.local;
  }

  return obj as EnvVarsMap;
})();

/**
 * A map of the environment variable names to the type.
 */
type EnvVarsMap = {
  [key in keyof EnvVarsDeclarationsMap]: EnvVarsDeclarationsMap[key] extends string ? string : () => Promise<string>;
};

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
