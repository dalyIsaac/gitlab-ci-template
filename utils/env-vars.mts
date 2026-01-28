import { $ } from "zx";
import { createGetTypedEnvVarFromEnv, env, getEnvVarFromConfigName, IS_CI, type VariableConfig, type CustomVariableEnv } from "./env-utils.mts";

/**
 * The declarations for all environment variables used in the pipeline.
 * All declarations must use {@link defineVariable}.
 */
const ENV_VAR_DECLARATIONS = [
  defineVariable<"CI_PROJECT_ID", string, readonly []>({
    name: "CI_PROJECT_ID" as const,
    local: async (ctx) => getEnvVarFromConfigName(ctx),
    pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
  }),
  defineVariable<"CI_PIPELINE_IID", string, readonly []>({
    name: "CI_PIPELINE_IID" as const,
    local: async (ctx) => getEnvVarFromConfigName(ctx),
    pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
  }),
  defineVariable<"CI_COMMIT_REF_NAME", string, readonly []>({
    name: "CI_COMMIT_REF_NAME" as const,
    local: async () => {
      const output = await $`git rev-parse --abbrev-ref HEAD`;
      return output.valueOf();
    },
    pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
  }),
  defineVariable<"CI_PROJECT_DIR", string, readonly []>({
    name: "CI_PROJECT_DIR" as const,
    local: async (ctx) => "/home/username/repos/gitlab-ci-template",
    pipeline: async (ctx) => getEnvVarFromConfigName(ctx),
  }),
  defineVariable<"UTILS_DIR", string, readonly ["CI_PROJECT_DIR"]>({
    name: "UTILS_DIR" as const,
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
  defineVariable<"CI_MERGE_REQUEST_APPROVED", boolean, readonly []>({
    name: "CI_MERGE_REQUEST_APPROVED" as const,
    local: async () => false,
    pipeline: createGetTypedEnvVarFromEnv("boolean"),
  }),
  defineVariable<"CI_MERGE_REQUEST_IID", number, readonly []>({
    name: "CI_MERGE_REQUEST_IID" as const,
    local: async () => 1,
    pipeline: createGetTypedEnvVarFromEnv("number"),
  }),
] as const satisfies Variable<string>[];

/**
 * Type for variable declarations - must be a VariableConfig defined with defineVariable.
 */
type Variable<TName extends string> = VariableConfig<TName, any, any, any>;

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
 * @template TName - The name of the variable
 * @template TResult - The return type of the variable
 * @template TDeps - The dependencies array type
 * @template TEnvMap - The environment variable type map
 */
function defineVariable<
  TName extends string,
  TResult,
  const TDeps extends readonly string[],
  TEnvMap extends Record<string, any> = {}
>(config: {
  readonly name: TName;
  readonly deps?: TDeps;
  readonly local: (ctx: VariableContext<TName, TResult, TDeps, TEnvMap>) => Promise<TResult>;
  readonly pipeline: (ctx: VariableContext<TName, TResult, TDeps, TEnvMap>) => Promise<TResult>;
}): VariableConfig<TName, TResult, TDeps, TEnvMap> {
  return config as VariableConfig<TName, TResult, TDeps, TEnvMap>;
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
  const visited = new Set<string>();
  const recStack = new Set<string>();
  
  const detectCycle = (node: string, path: string[]): string | null => {
    if (recStack.has(node)) {
      // Found a cycle, return the cycle path
      const cycleStart = path.indexOf(node);
      return [...path.slice(cycleStart), node].join(" -> ");
    }
    if (visited.has(node)) return null;
    
    visited.add(node);
    recStack.add(node);
    
    const deps = depGraph.get(node);
    if (deps) {
      for (const dep of deps) {
        const cycle = detectCycle(dep, [...path, node]);
        if (cycle) return cycle;
      }
    }
    
    recStack.delete(node);
    return null;
  };
  
  for (const node of depGraph.keys()) {
    const cycle = detectCycle(node, []);
    if (cycle) {
      throw new Error(`Circular dependency detected: ${cycle}`);
    }
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
    // All variables now have a local field since they're all defined with defineVariable
    localVarNames.push(config.name as LocalVarNames);
  }

  return getPipelineEnvVars(...localVarNames);
}

/**
 * The names of all environment variables that are available locally.
 * Since all variables are now defined with defineVariable and have both local and pipeline implementations,
 * all variables are available locally.
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
 * All variables are now functions returning promises since they're all defined with defineVariable.
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
 * All elements are now VariableConfig objects with a name property.
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
 * handles the env typing automatically.
 * 
 * **Type inference limitation**: Inside the defineVariable function body (local/pipeline),
 * ctx.env properties have limited type inference and may appear as `any`. This is because
 * the TEnvMap generic defaults to an empty object. While the external interface maintains
 * type safety (you can only declare valid dependencies), developers should be careful when
 * accessing ctx.env properties and rely on the explicit return type annotation for safety.
 * 
 * Usage example:
 * ```ts
 * defineVariable({
 *   name: "UTILS_DIR" as const,
 *   deps: ["CI_PROJECT_DIR"] as const,
 *   local: async (ctx): Promise<string> => {
 *     // Note: ctx.env.CI_PROJECT_DIR type inference is limited inside this function
 *     // The explicit Promise<string> return type provides the main type safety
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
