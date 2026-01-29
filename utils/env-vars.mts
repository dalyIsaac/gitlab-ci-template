import { $ } from "zx";
import { detectCycle } from "./cycle-detection.mts";
import { createGetTypedEnvVarFromEnv, env, getEnvVarFromConfigName, IS_CI, type VariableConfig, type CustomVariableEnv } from "./env-utils.mts";

/**
 * The declarations for all environment variables used in the pipeline.
 * All declarations must use {@link defineVariable}.
 */
const ENV_VAR_DECLARATIONS = [
  defineVariable({
    name: "CI_PROJECT_ID",
    local: async (ctx) => getEnvVarFromConfigName(ctx),
    pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
  }),
  defineVariable({
    name: "CI_PIPELINE_IID",
    local: async (ctx) => getEnvVarFromConfigName(ctx),
    pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
  }),
  defineVariable({
    name: "CI_COMMIT_REF_NAME",
    local: async () => {
      const output = await $`git rev-parse --abbrev-ref HEAD`;
      return output.valueOf();
    },
    pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
  }),
  defineVariable({
    name: "CI_PROJECT_DIR",
    local: async (ctx) => "/home/username/repos/gitlab-ci-template",
    pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
  }),
  defineVariable({
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
  }),

  // Merge request specific variables.
  defineVariable({
    name: "CI_MERGE_REQUEST_APPROVED",
    local: async () => false,
    pipeline: createGetTypedEnvVarFromEnv("boolean"),
  }),
  defineVariable({
    name: "CI_MERGE_REQUEST_IID",
    local: async () => 1,
    pipeline: createGetTypedEnvVarFromEnv("number"),
  }),
] as const satisfies Variable<string>[];

/**
 * Type for variable declarations - must be a VariableConfig defined with defineVariable.
 */
type Variable<TName extends string> = VariableConfig<TName, any, any, any>;

/**
 * Builds an environment map for the given dependencies by looking up their types
 * from EnvVarsMap. This is a forward reference that will be resolved at type-checking time,
 * after EnvVarsMap is fully defined.
 * 
 * This allows ctx.env to have proper typing based on the declared dependencies.
 * For dependencies that exist in EnvVarsMap, it maps to their proper function type.
 * For dependencies that don't exist yet, it falls back to () => Promise<any>.
 * 
 * @template TDeps - Array of dependency names
 */
type BuildEnvMapFromDeps<TDeps extends readonly string[]> = {
  [K in TDeps[number]]: K extends keyof EnvVarsMap
    ? EnvVarsMap[K]
    : () => Promise<any>;
};

/**
 * Context type for custom variable functions in defineVariable.
 * 
 * @template TName - The name of the variable
 * @template TResult - The return type of the variable
 * @template TDeps - The dependencies array type
 * @template TEnvMap - The environment variable type map
 */
type VariableContext<
  TName extends string,
  TResult,
  TDeps extends readonly string[],
  TEnvMap extends Record<string, any>
> = {
  config: VariableConfig<TName, TResult, TDeps, TEnvMap>;
  env: CustomVariableEnv<TDeps, TEnvMap>;
};

/**
 * Helper function to define a variable with proper type inference.
 * This provides type safety for the env parameter without using `as const satisfies` inline.
 * 
 * The env parameter in the context will have proper types for dependencies that have been
 * declared earlier in the ENV_VAR_DECLARATIONS array. The type system builds up the map
 * progressively as each variable is declared.
 * 
 * @template TName - The name of the variable
 * @template TResult - The return type of the variable
 * @template TDeps - The dependencies array type
 * @template TEnvMap - The environment variable type map
 */
function defineVariable<
  const TConfig extends {
    readonly name: string;
    readonly deps?: readonly string[];
    readonly local: (ctx: VariableContext<string, any, readonly string[], any>) => Promise<any>;
    readonly pipeline: (ctx: VariableContext<string, any, readonly string[], any>) => Promise<any>;
  }
>(
  config: TConfig
): VariableConfig<
  TConfig["name"],
  Awaited<ReturnType<TConfig["local"]>>,
  TConfig["deps"] extends readonly string[] ? TConfig["deps"] : readonly [],
  BuildEnvMapFromDeps<TConfig["deps"] extends readonly string[] ? TConfig["deps"] : readonly []>
> {
  return config as any;
}

/**
 * A map of {@link ENV_VAR_DECLARATIONS} names to the values or getter functions.
 */
export const ENV_VARS_MAP = (() => {
  // First pass: Build dependency graph and detect circular dependencies
  const depGraph = new Map<string, Set<string>>();
  
  for (const config of ENV_VAR_DECLARATIONS) {
    const typedConfig = config as VariableConfig<any, any, any, any>;
    if (typedConfig.deps && typedConfig.deps.length > 0) {
      depGraph.set(typedConfig.name, new Set(typedConfig.deps as string[]));
    }
  }
  
  // Detect circular dependencies using DFS
  const cycle = detectCycle(depGraph);
  if (cycle) {
    throw new Error(`Circular dependency detected: ${cycle}`);
  }

  // Second pass: Build the env vars map
  const obj: Partial<EnvVarsMap> = {};

  for (const config of ENV_VAR_DECLARATIONS) {
    const variant = IS_CI ? "pipeline" : "local";

    // Cast to ignore ENV_VAR_DECLARATIONS being a readonly tuple.
    const typedConfig = config as VariableConfig<string, any, any, any>;

    obj[config.name] = () => {
      // Build the env object with only the declared dependencies
      const envObj: any = {};
      if (typedConfig.deps) {
        for (const dep of typedConfig.deps) {
          // Validate that the dependency exists
          if (!(dep in obj)) {
            throw new Error(
              `Dependency '${dep}' for variable '${typedConfig.name}' is not defined. ` +
              `Dependencies must be declared before the variables that depend on them.`
            );
          }
          envObj[dep] = obj[dep as keyof typeof obj];
        }
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
  [K in keyof EnvVarsDeclarationsMap]: EnvVarsDeclarationsMap[K] extends VariableConfig<any, any, any, any>
    ? K
    : never;
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
  [P in T[number] as P extends { name: infer N }
    ? N extends string
      ? N
      : never
    : never]: P;
};

/**
 * Properly typed environment object for custom variable functions.
 * Maps each dependency name to its actual type from EnvVarsMap.
 * This is similar to how PipelineEnvVarsRecord works.
 * 
 * Note: This type is exported for documentation purposes but is primarily used
 * internally by the defineVariable helper. When using defineVariable, type inference
 * handles the env typing automatically based on the declared dependencies.
 * 
 * The type system will properly infer types for dependencies that have been declared
 * earlier in the ENV_VAR_DECLARATIONS array. Dependencies are resolved from the
 * EnvVarsMap, providing full type safety and IDE autocomplete within the function bodies.
 * 
 * Usage example:
 * ```ts
 * defineVariable({
 *   name: "UTILS_DIR" as const,
 *   deps: ["CI_PROJECT_DIR"] as const,
 *   local: async (ctx): Promise<string> => {
 *     // ctx.env.CI_PROJECT_DIR is properly typed as () => Promise<string>
 *     const projectDir = await ctx.env.CI_PROJECT_DIR();
 *     return `${projectDir}/utils`;
 *   },
 *   pipeline: async (ctx): Promise<string> => {
 *     const projectDir = await ctx.env.CI_PROJECT_DIR();
 *     return `${projectDir}/utils`;
 *   },
 * })
 * ```
 */
export type TypedCustomVariableEnv<TDeps extends readonly (keyof EnvVarsDeclarationsMap)[]> = {
  [K in TDeps[number]]: EnvVarsMap[K];
};
