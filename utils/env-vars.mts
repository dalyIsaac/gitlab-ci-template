import { $ } from "zx";
import { buildDependencyGraphFromDeclarations, detectCycle } from "./deps-graph.mts";
import { createGetTypedEnvVarFromEnv, getEnvVarFromConfigName, IS_CI, type VariableConfig } from "./env-utils.mts";

/**
 * Builder types for defining env vars with typed dependencies.
 */
type EnvVarGetterMap = Record<string, () => Promise<any>>;

type AddConfigReturn<
  TEnvMap extends EnvVarGetterMap,
  TConfigs extends readonly VariableConfig<any, any, any, any>[],
  TConfig extends VariableConfig<string, any, any, TEnvMap>,
> = EnvVarBuilder<
  TEnvMap & { [K in TConfig["name"]]: () => Promise<Awaited<ReturnType<TConfig["local"]>>> },
  readonly [...TConfigs, TConfig]
>;

/**
 * Builder for environment variables with dependency tracking and cycle detection.
 *
 * @template TEnvMap The map of environment variable getters defined so far.
 * @template TConfigs The list of variable configurations added so far.
 */
class EnvVarBuilder<TEnvMap extends EnvVarGetterMap, TConfigs extends readonly VariableConfig<any, any, any, any>[]> {
  private readonly configs: VariableConfig<any, any, any, any>[] = [];

  /**
   * Adds a new variable configuration to the builder.
   *
   * @template TName The name of the environment variable.
   * @template TDeps The names of the environment variables that this variable depends on.
   * @template TConfig The variable configuration being added.
   * @param config The variable configuration to add.
   * @returns A new `EnvVarBuilder` instance with the added configuration.
   */
  // Overload 1: no deps -> `ctx.env` is empty, so access is disallowed.
  // This preserves a strict empty dependency list for config functions.
  add<const TName extends string, const TConfig extends VariableConfig<TName, any, readonly [], TEnvMap>>(
    config: TConfig & { deps?: undefined },
  ): AddConfigReturn<TEnvMap, TConfigs, TConfig>;
  // Overload 2: deps provided -> `ctx.env` is limited to only those declared deps.
  // This keeps dependency access precise (e.g., UTILS_DIR only sees CI_PROJECT_DIR).
  add<
    const TName extends string,
    const TDeps extends readonly Extract<keyof TEnvMap, string>[],
    const TConfig extends VariableConfig<TName, any, TDeps, TEnvMap>,
  >(config: TConfig & { deps: TDeps }): AddConfigReturn<TEnvMap, TConfigs, TConfig>;
  add(config: VariableConfig<string, any, readonly string[], TEnvMap>) {
    this.configs.push(config);
    return this as any;
  }

  /**
   * Builds the environment variable getter map, checking for circular dependencies.
   *
   * @returns The map of environment variable getters.
   * @throws If a circular dependency is detected among the variables.
   */
  build(): TEnvMap {
    const variant = IS_CI ? "pipeline" : "local";

    const dependencyGraph = buildDependencyGraphFromDeclarations([...this.configs]);
    const cycle = detectCycle(dependencyGraph);
    if (cycle) {
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    const map: Partial<EnvVarGetterMap> = {};

    for (const config of this.configs) {
      const typedConfig = config as VariableConfig<string, any, any, any>;
      map[config.name] = this.#buildEnvGetter(map, typedConfig, variant);
    }

    return map as TEnvMap;
  }

  #buildEnvGetter(map: Partial<EnvVarGetterMap>, typedConfig: VariableConfig<string, any, any, any>, variant: "pipeline" | "local") {
    return () => {
      const envObj: any = {};

      if (typedConfig.deps === undefined) {
        return typedConfig[variant]({ config: typedConfig, env: envObj });
      }

      for (const dep of typedConfig.deps) {
        if (!(dep in map)) {
          throw new Error(
            `Dependency '${dep}' for variable '${typedConfig.name}' is not defined. ` +
              `Dependencies must be declared before the variables that depend on them.`,
          );
        }
        envObj[dep] = map[dep as keyof typeof map];
      }

      return typedConfig[variant]({ config: typedConfig, env: envObj });
    };
  }
}

/**
 * The map of all environment variables used in the pipeline.
 * Dependencies are typed from previously declared variables.
 */
export const ENV_VARS_MAP = new EnvVarBuilder<{}, readonly []>()
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
 * Gets the local variants of all environment variables defined in {@link ENV_VARS_MAP}.
 *
 * @returns An object mapping the variable names to their values or getters.
 */
export function getLocalEnvVars(): PipelineEnvVarsRecord<LocalVarNames> {
  const localVarNames = Object.keys(ENV_VARS_MAP) as LocalVarNames[];

  return getPipelineEnvVars(...localVarNames);
}

/**
 * The names of all environment variables that are available locally.
 * All variables are available locally.
 */
type LocalVarNames = keyof EnvVarsMap;

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
export type EnvVarsMap = typeof ENV_VARS_MAP;
