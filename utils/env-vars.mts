import { $ } from "zx";
import { detectCycle } from "./cycle-detection.mts";
import { createGetTypedEnvVarFromEnv, env, getEnvVarFromConfigName, IS_CI, type VariableConfig, type CustomVariableEnv } from "./env-utils.mts";

/**
 * Helper type that progressively builds the environment map.
 * This is used to provide proper type inference for ctx.env within defineVariable.
 */
type ProgressiveEnvMap = {
  CI_PROJECT_ID: () => Promise<string>;
  CI_PIPELINE_IID: () => Promise<string>;
  CI_COMMIT_REF_NAME: () => Promise<string>;
  CI_PROJECT_DIR: () => Promise<string>;
  UTILS_DIR: () => Promise<string>;
  CI_MERGE_REQUEST_APPROVED: () => Promise<boolean>;
  CI_MERGE_REQUEST_IID: () => Promise<number>;
};

/**
 * Builds an environment map for the given dependencies by looking up their types
 * from ProgressiveEnvMap. This provides proper type inference within defineVariable.
 * 
 * @template TDeps - Array of dependency names
 */
type BuildProgressiveEnvMapFromDeps<TDeps extends readonly string[]> = {
  [K in TDeps[number]]: K extends keyof ProgressiveEnvMap
    ? ProgressiveEnvMap[K]
    : () => Promise<any>;
};

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
    local: async (ctx): Promise<string> => {
      const projectDir = await ctx.env.CI_PROJECT_DIR();
      return `${projectDir}/utils`;
    },
    pipeline: async (ctx): Promise<string> => {
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
 * This provides proper type metadata for the VariableConfig based on declared dependencies.
 * For dependencies that exist in EnvVarsMap, it maps to their proper function type.
 * For dependencies that do not exist in EnvVarsMap (e.g., typos or undeclared variables), it falls back to () => Promise<any>.
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
 * This provides type safety for the env parameter by using ProgressiveEnvMap.
 * 
 * The env parameter in the context has types derived from ProgressiveEnvMap via
 * BuildProgressiveEnvMapFromDeps, which provides proper type inference within the
 * function body during authoring, allowing IDE autocomplete and type checking for
 * ctx.env properties based on declared dependencies.
 */

// Overload for variables with dependencies
function defineVariable<
  TName extends string,
  TDeps extends readonly (keyof ProgressiveEnvMap)[],
  TLocal extends (
    ctx: VariableContext<TName, any, TDeps, BuildProgressiveEnvMapFromDeps<TDeps>>
  ) => Promise<any>,
  TPipeline extends (
    ctx: VariableContext<TName, any, TDeps, BuildProgressiveEnvMapFromDeps<TDeps>>
  ) => Promise<any>
>(config: {
  readonly name: TName;
  readonly deps: TDeps;
  readonly local: TLocal;
  readonly pipeline: TPipeline;
}): VariableConfig<TName, Awaited<ReturnType<TLocal>>, TDeps, BuildEnvMapFromDeps<TDeps>>;

// Overload for variables without dependencies
function defineVariable<
  TName extends string,
  TLocal extends (ctx: VariableContext<TName, any, readonly [], {}>) => Promise<any>,
  TPipeline extends (ctx: VariableContext<TName, any, readonly [], {}>) => Promise<any>
>(config: {
  readonly name: TName;
  readonly local: TLocal;
  readonly pipeline: TPipeline;
}): VariableConfig<TName, Awaited<ReturnType<TLocal>>, readonly [], {}>;

// Implementation
function defineVariable(config: any): any {
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
 * TypeScript resolves EnvVarsMap through deferred resolution, meaning the entire map is
 * resolved at once after the module is fully parsed. The BuildEnvMapFromDeps type provides
 * correct type metadata in the returned VariableConfig, improving type safety for the
 * resulting environment variable getters.
 * 
 * Note: Within the defineVariable function body itself, ctx.env properties are typed as 'any'
 * due to the generic parameter constraints. The proper typing applies to the type metadata of
 * the returned VariableConfig, not to IDE autocomplete when authoring the function.
 * 
 * Usage example:
 * ```ts
 * defineVariable({
 *   name: "UTILS_DIR" as const,
 *   deps: ["CI_PROJECT_DIR"] as const,
 *   local: async (ctx): Promise<string> => {
 *     // Note: ctx.env.CI_PROJECT_DIR is typed as 'any' during authoring
 *     // Explicit return type annotation provides the main type safety
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
