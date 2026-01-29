import { $ } from "zx";
import { detectCycle } from "./cycle-detection.mts";
import { createGetTypedEnvVarFromEnv, env, getEnvVarFromConfigName, IS_CI, type VariableConfig } from "./env-utils.mts";

/**
 * Environment Variable Architecture
 * ==================================
 * 
 * This module uses a progressive, staged approach to define environment variables with
 * full type safety and automatic type inference, without requiring explicit return type
 * annotations.
 * 
 * Key Features:
 * - Variables are defined in stages, allowing later variables to depend on earlier ones
 * - Type inference works automatically - no need for explicit return type annotations
 * - ctx.env properties are properly typed during authoring with IDE autocomplete
 * - No circular type dependencies
 * - No manual maintenance of type maps
 * 
 * Architecture:
 * 1. Stage 1: Define base variables without dependencies using defineSimpleVariable()
 * 2. Build Stage1EnvMap type from stage 1 variables
 * 3. Stage 2+: Define dependent variables using defineVariableWithDeps() with the env map
 * 4. Combine all variables into ENV_VAR_DECLARATIONS array
 * 
 * Example:
 * ```typescript
 * // Stage 1: Base variable
 * const CI_PROJECT_DIR = defineSimpleVariable({
 *   name: "CI_PROJECT_DIR" as const,
 *   local: async () => "/home/user/project",
 *   pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
 * });
 * 
 * // Build type map
 * type Stage1EnvMap = {
 *   CI_PROJECT_DIR: () => Promise<string>;
 * };
 * 
 * // Stage 2: Dependent variable
 * const UTILS_DIR = defineVariableWithDeps({
 *   name: "UTILS_DIR" as const,
 *   deps: ["CI_PROJECT_DIR"] as const,
 *   envMap: {} as Stage1EnvMap,
 *   local: async (ctx) => {
 *     // projectDir is automatically typed as string!
 *     const projectDir = await ctx.env.CI_PROJECT_DIR();
 *     return `${projectDir}/utils`;
 *   },
 *   pipeline: async (ctx) => { ... },
 * });
 * ```
 */

/**
 * Helper to define a variable without dependencies.
 * The return type is automatically inferred from the function.
 */
function defineSimpleVariable<
  TName extends string,
  TLocalResult,
  TPipelineResult
>(config: {
  readonly name: TName;
  readonly local: () => Promise<TLocalResult>;
  readonly pipeline: (ctx: { config: any; env: {} }) => Promise<TPipelineResult>;
}): VariableConfig<TName, TLocalResult, readonly [], {}> {
  return config as any;
}

/**
 * Helper to define a variable with dependencies.
 * The env parameter is typed based on the provided TEnvMap.
 * Return types are automatically inferred from the function implementations.
 */
function defineVariableWithDeps<
  TName extends string,
  TDeps extends readonly string[],
  TEnvMap extends Record<string, () => Promise<any>>,
  TLocalResult,
  TPipelineResult
>(config: {
  readonly name: TName;
  readonly deps: TDeps;
  readonly envMap: TEnvMap;
  readonly local: (ctx: { config: any; env: Pick<TEnvMap, TDeps[number]> }) => Promise<TLocalResult>;
  readonly pipeline: (ctx: { config: any; env: Pick<TEnvMap, TDeps[number]> }) => Promise<TPipelineResult>;
}): VariableConfig<TName, TLocalResult, TDeps, Pick<TEnvMap, TDeps[number]>> {
  const { envMap, ...rest } = config;
  return rest as any;
}

// Stage 1: Define variables without dependencies
const CI_PROJECT_ID = defineSimpleVariable({
  name: "CI_PROJECT_ID" as const,
  local: async () => env("CI_PROJECT_ID"),
  pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
});

const CI_PIPELINE_IID = defineSimpleVariable({
  name: "CI_PIPELINE_IID" as const,
  local: async () => env("CI_PIPELINE_IID"),
  pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
});

const CI_COMMIT_REF_NAME = defineSimpleVariable({
  name: "CI_COMMIT_REF_NAME" as const,
  local: async () => {
    const output = await $`git rev-parse --abbrev-ref HEAD`;
    return output.valueOf();
  },
  pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
});

const CI_PROJECT_DIR = defineSimpleVariable({
  name: "CI_PROJECT_DIR" as const,
  local: async () => "/home/username/repos/gitlab-ci-template",
  pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
});

// Stage 2: Build type map from stage 1 variables
type Stage1EnvMap = {
  CI_PROJECT_ID: () => Promise<string>;
  CI_PIPELINE_IID: () => Promise<string>;
  CI_COMMIT_REF_NAME: () => Promise<string>;
  CI_PROJECT_DIR: () => Promise<string>;
};

// Stage 3: Define variables with dependencies on stage 1
const UTILS_DIR = defineVariableWithDeps({
  name: "UTILS_DIR" as const,
  deps: ["CI_PROJECT_DIR"] as const,
  envMap: {} as Stage1EnvMap,
  local: async (ctx) => {
    const projectDir = await ctx.env.CI_PROJECT_DIR();
    return `${projectDir}/utils`;
  },
  pipeline: async (ctx) => {
    const projectDir = await ctx.env.CI_PROJECT_DIR();
    return `${projectDir}/utils`;
  },
});

// Stage 4: Define remaining variables
const CI_MERGE_REQUEST_APPROVED = defineSimpleVariable({
  name: "CI_MERGE_REQUEST_APPROVED" as const,
  local: async () => false,
  pipeline: createGetTypedEnvVarFromEnv("boolean"),
});

const CI_MERGE_REQUEST_IID = defineSimpleVariable({
  name: "CI_MERGE_REQUEST_IID" as const,
  local: async () => 1,
  pipeline: createGetTypedEnvVarFromEnv("number"),
});

/**
 * The declarations for all environment variables used in the pipeline.
 */
const ENV_VAR_DECLARATIONS = [
  CI_PROJECT_ID,
  CI_PIPELINE_IID,
  CI_COMMIT_REF_NAME,
  CI_PROJECT_DIR,
  UTILS_DIR,
  CI_MERGE_REQUEST_APPROVED,
  CI_MERGE_REQUEST_IID,
] as const satisfies readonly VariableConfig<string, any, any, any>[];

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
 * 
 * With the progressive, staged architecture, environment variables with dependencies
 * have properly typed ctx.env parameters during authoring. The type system automatically
 * infers return types without requiring explicit annotations.
 * 
 * The staged approach:
 * 1. Define variables without dependencies using defineSimpleVariable()
 * 2. Build a type map from those variables
 * 3. Use that type map with defineVariableWithDeps() for dependent variables
 * 4. ctx.env properties are fully typed with IDE autocomplete support
 * 
 * Usage example:
 * ```ts
 * // Stage 1: Base variable
 * const CI_PROJECT_DIR = defineSimpleVariable({
 *   name: "CI_PROJECT_DIR" as const,
 *   local: async () => "/home/user/project",
 *   pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
 * });
 * 
 * // Stage 1 type map
 * type Stage1EnvMap = {
 *   CI_PROJECT_DIR: () => Promise<string>;
 * };
 * 
 * // Stage 2: Dependent variable with automatic type inference
 * const UTILS_DIR = defineVariableWithDeps({
 *   name: "UTILS_DIR" as const,
 *   deps: ["CI_PROJECT_DIR"] as const,
 *   envMap: {} as Stage1EnvMap,
 *   local: async (ctx) => {
 *     // projectDir is automatically inferred as string - no explicit type needed!
 *     const projectDir = await ctx.env.CI_PROJECT_DIR();
 *     return `${projectDir}/utils`;
 *   },
 *   pipeline: async (ctx) => {
 *     const projectDir = await ctx.env.CI_PROJECT_DIR();
 *     return `${projectDir}/utils`;
 *   },
 * });
 * ```
 */
export type TypedCustomVariableEnv<TDeps extends readonly (keyof EnvVarsDeclarationsMap)[]> = {
  [K in TDeps[number]]: EnvVarsMap[K];
};
