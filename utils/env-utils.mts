import { $ } from "zx";

export const IS_CI = process.env["GITLAB_CI"] === "true";

/**
 * Gets the value of an environment variable.
 *
 * @param varName The name of the environment variable.
 * @returns The value of the environment variable.
 * @throws If the environment variable is not defined.
 */
export const env = (varName: string): string => {
  const value = process.env[varName];

  if (value === undefined) {
    throw new Error(`Environment variable "${varName}" is not defined.`);
  }

  return value;
};

/**
 * The configuration for an environment variable.
 */
export interface VariableConfig<TName extends string, TResult> {
  name: TName;
  local: CustomVariableFn<TName, TResult>;
  pipeline: CustomVariableFn<TName, TResult>;
}

export type CustomVariableFn<TName extends string, TResult = string> = (config: VariableConfig<TName, TResult>) => Promise<TResult>;

export const createGetTypedEnvVarFromEnv =
  <TCustomVariableType extends CustomVariableType>(type: TCustomVariableType) =>
  async <TName extends string>(
    config: VariableConfig<TName, StringTypeToType<TCustomVariableType>>,
  ): Promise<StringTypeToType<TCustomVariableType>> => {
    const value = env(config.name);
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
 * @param config The custom variable configuration.
 * @returns The value of the environment variable.
 */
export const getEnvVarFromConfigName = async <TName extends string>(config: VariableConfig<TName, string>): Promise<string> => env(config.name);

export type CustomVariableType = "string" | "number" | "boolean";

/**
 * Creates a function that gets the value of an environment variable by executing a shell command.
 *
 * @param command The shell command to execute.
 * @returns A function that executes the command and returns the output as a string.
 */
export const createGetEnvVarFromShell = (command: string) => async (): Promise<string> => {
  const output = await $`${command}`;
  return output.valueOf();
};

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
