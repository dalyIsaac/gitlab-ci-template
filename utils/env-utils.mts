export const IS_CI = process.env["GITLAB_CI"] === "true";

/**
 * Gets the value of an environment variable.
 *
 * **This should not be used outside of pipeline, env-vars, or env-utils modules.**
 *
 * @param varName The name of the environment variable.
 * @param fallback The fallback value if the environment variable is not defined.
 * @returns The value of the environment variable.
 * @throws If the environment variable is not defined.
 */
export const env = (varName: string, fallback?: string): string => {
  const value = process.env[varName];

  if (value === undefined) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`Environment variable "${varName}" is not defined.`);
  }

  return value;
};

/**
 * The configuration for an environment variable.
 *
 * @template TName The name of the environment variable
 * @template TResult The return type of the variable's value
 * @template TDeps Array of dependency variable names
 * @template TEnvMap Map of variable names to their types
 */
export interface VariableConfig<
  TName extends string,
  TResult,
  TDeps extends readonly string[] = readonly string[],
  TEnvMap extends Record<string, any> = {},
> {
  name: TName;
  deps?: TDeps;
  local: CustomVariableFn<TName, TResult, TDeps, TEnvMap>;
  pipeline: CustomVariableFn<TName, TResult, TDeps, TEnvMap>;
}

export type CustomVariableFn<
  TName extends string,
  TResult = string,
  TDeps extends readonly string[] = readonly string[],
  TEnvMap extends Record<string, any> = {},
> = (ctx: { config: VariableConfig<TName, TResult, TDeps, TEnvMap>; env: CustomVariableEnv<TDeps, TEnvMap> }) => Promise<TResult>;

/**
 * Environment object containing only the declared dependencies for a custom variable function.
 * This will be specialized per use-site to map dependency names to their actual types.
 *
 * @template TDeps Array of dependency names
 * @template TEnvMap Map of variable names to their types (defaults to empty object)
 */
export type CustomVariableEnv<TDeps extends readonly string[], TEnvMap extends Record<string, any> = {}> = {
  [K in TDeps[number]]: K extends keyof TEnvMap ? TEnvMap[K] : any;
};

export const createGetTypedEnvVarFromEnv =
  <TCustomVariableType extends CustomVariableType>(type: TCustomVariableType, fallback?: string) =>
  async <TName extends string, TDeps extends readonly string[] = readonly string[], TEnvMap extends Record<string, any> = {}>(ctx: {
    config: VariableConfig<TName, StringTypeToType<TCustomVariableType>, TDeps, TEnvMap>;
    env: CustomVariableEnv<TDeps, TEnvMap>;
  }): Promise<StringTypeToType<TCustomVariableType>> => {
    const value = env(ctx.config.name, fallback);
    return tryCastValue(value, type);
  };

/**
 * Maps a custom variable type string to its corresponding TypeScript type.
 * For example, "number" maps to number.
 */
type StringTypeToType<TCustomVariableType> = TCustomVariableType extends "number"
  ? number
  : TCustomVariableType extends "boolean"
    ? boolean
    : string;

/**
 * Gets the value of an environment variable from the environment.
 *
 * @param ctx The context object containing config and env.
 * @param fallback Optional fallback value to use when the environment variable is not defined.
 * @returns The value of the environment variable, or the fallback if not defined.
 * @throws If the environment variable is not defined and no fallback value is provided.
 */
export const getEnvVarFromConfigName = async <
  TName extends string,
  TDeps extends readonly string[] = readonly string[],
  TEnvMap extends Record<string, any> = {},
>(
  ctx: {
    config: VariableConfig<TName, string, TDeps, TEnvMap>;
    env: CustomVariableEnv<TDeps, TEnvMap>;
  },
  fallback?: string,
): Promise<string> => env(ctx.config.name, fallback);

export type CustomVariableType = "string" | "number" | "boolean";

/**
 * Cast a string value to the specified type.
 */
const tryCastValue = <T extends CustomVariableType | undefined>(
  value: string | undefined,
  type: T,
): T extends "number" ? number : T extends "boolean" ? boolean : string => {
  if (value === undefined) {
    throw new Error(`Environment variable is undefined`);
  }

  // TypeScript can't prove branches return the correct type for the conditional,
  // even though it does. We assert to satisfy the return type.
  switch (type) {
    case "number":
      return Number(value) as any;
    case "boolean":
      return (value.toLowerCase() === "true") as any;
    case undefined:
    case "string":
      return value as any;
    default:
      throw new Error(`Could not convert value "${value}" to type "${type}"`);
  }
};
