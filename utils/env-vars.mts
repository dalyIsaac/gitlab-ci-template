import { $ } from "zx";
import { detectCycle } from "./cycle-detection.mts";
import { createGetTypedEnvVarFromEnv, getEnvVarFromConfigName, IS_CI, type VariableConfig } from "./env-utils.mts";

/**
 * The declarations for all environment variables used in the pipeline.
 * Dependencies are typed from previously declared variables.
 */
const ENV_VAR_DECLARATIONS = createEnvVarBuilder()
  .add({
    name: "CI_PROJECT_ID",
    local: getEnvVarFromConfigName,
    pipeline: getEnvVarFromConfigName,
  })
  .add({
    name: "CI_PIPELINE_IID",
    local: getEnvVarFromConfigName,
    pipeline: getEnvVarFromConfigName,
  })
  .add({
    name: "CI_COMMIT_REF_NAME",
    local: async () => {
      const output = await $`git rev-parse --abbrev-ref HEAD`;
      return output.valueOf();
    },
    pipeline: getEnvVarFromConfigName,
  })
  .add({
    name: "CI_PROJECT_DIR",
    local: async (ctx) => "/home/username/repos/gitlab-ci-template",
    pipeline: getEnvVarFromConfigName,
  })
  .add({
    name: "UTILS_DIR",
    deps: ["CI_PROJECT_DIR"] as const,
    local: async (ctx) => {
      const projectDir = await ctx.env.CI_PROJECT_DIR();
      return `${projectDir}/utils`;
    },
    pipeline: async (ctx) => {
      const projectDir = await ctx.env.CI_PROJECT_DIR();
      return `${projectDir}/utils`;
    },
  })

  // Merge request specific variables.
  .add({
    name: "CI_MERGE_REQUEST_APPROVED",
    local: async () => false,
    pipeline: createGetTypedEnvVarFromEnv("boolean"),
  })
  .add({
    name: "CI_MERGE_REQUEST_IID",
    local: async () => 1,
    pipeline: createGetTypedEnvVarFromEnv("number"),
  })
  .build();

/**
 * Builder types for defining env vars with typed dependencies.
 */
type EnvVarGetterMap = Record<string, () => Promise<any>>;

type EnvVarBuilder<TEnvMap extends EnvVarGetterMap, TConfigs extends readonly VariableConfig<any, any, any, any>[]> = {
  add<const TConfig extends VariableConfig<string, any, readonly Extract<keyof TEnvMap, string>[], TEnvMap>>(
    config: TConfig,
  ): EnvVarBuilder<
    TEnvMap & { [K in TConfig["name"]]: () => Promise<Awaited<ReturnType<TConfig["local"]>>> },
    readonly [...TConfigs, TConfig]
  >;
  build(): TConfigs;
};

function createEnvVarBuilder(): EnvVarBuilder<{}, readonly []> {
  const configs: VariableConfig<any, any, any, any>[] = [];
  const builder = {
    add(config: VariableConfig<any, any, any, any>) {
      configs.push(config);
      return builder as any;
    },
    build() {
      return configs as any;
    },
  };
  return builder as any;
}

/**
 * A map of {@link ENV_VAR_DECLARATIONS} names to the values or getter functions.
 */
export const ENV_VARS_MAP = (() => {
  // First pass: Build dependency graph and detect circular dependencies.
  const depGraph = new Map<string, Set<string>>();

  for (const config of ENV_VAR_DECLARATIONS) {
    const typedConfig = config as VariableConfig<any, any, any, any>;
    if (typedConfig.deps && typedConfig.deps.length > 0) {
      depGraph.set(typedConfig.name, new Set(typedConfig.deps as string[]));
    }
  }

  const cycle = detectCycle(depGraph);
  if (cycle) {
    throw new Error(`Circular dependency detected: ${cycle}`);
  }

  // Second pass: Build the env vars map.
  const obj: Partial<EnvVarsMap> = {};

  for (const config of ENV_VAR_DECLARATIONS) {
    const variant = IS_CI ? "pipeline" : "local";

    // Cast to ignore ENV_VAR_DECLARATIONS being a readonly tuple.
    const typedConfig = config as VariableConfig<string, any, any, any>;

    obj[config.name] = () => {
      // Build the env object with only the declared dependencies.
      const envObj: any = {};

      if (typedConfig.deps === undefined) {
        return typedConfig[variant]({ config: typedConfig, env: envObj });
      }

      for (const dep of typedConfig.deps) {
        // Validate that the dependency exists.
        if (!(dep in obj)) {
          throw new Error(
            `Dependency '${dep}' for variable '${typedConfig.name}' is not defined. ` +
              `Dependencies must be declared before the variables that depend on them.`,
          );
        }
        envObj[dep] = obj[dep as keyof typeof obj];
      }

      return typedConfig[variant]({ config: typedConfig, env: envObj });
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
    // All variables have a local field
    localVarNames.push(config.name as LocalVarNames);
  }

  return getPipelineEnvVars(...localVarNames);
}

/**
 * The names of all environment variables that are available locally.
 * All variables are available locally.
 */
type LocalVarNames = {
  [K in keyof EnvVarsDeclarationsMap]: EnvVarsDeclarationsMap[K] extends VariableConfig<any, any, any, any> ? K : never;
}[keyof EnvVarsDeclarationsMap];

/**
 * A record mapping environment variable names to their types.
 */
type PipelineEnvVarsRecord<TVarNames extends keyof EnvVarsMap> = {
  [key in TVarNames]: EnvVarsMap[key];
};

/**
 * A map of the environment variable names to the type.
 * All variables are functions returning promises.
 */
export type EnvVarsMap = {
  [key in keyof EnvVarsDeclarationsMap]: EnvVarsDeclarationsMap[key] extends VariableConfig<any, infer R, any, any>
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
 * All elements are VariableConfig objects with a name property.
 */
type ArrayToObject<T extends readonly any[]> = {
  [P in T[number] as P extends { name: infer N } ? (N extends string ? N : never) : never]: P;
};
