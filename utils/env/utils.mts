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
 * An environment variable which has a custom implementation when running on a local machine.
 */
export interface CustomVariableConfig<TName extends string, TResult = string> {
  name: TName;
  local: CustomVariableFn<TName, TResult>;
  pipeline: CustomVariableFn<TName, TResult>;
}

export type CustomVariableFn<TName extends string, TResult = string> = (config: CustomVariableConfig<TName, TResult>) => Promise<TResult>;

/**
 * Gets the value of an environment variable from a custom configuration.
 *
 * @param config The custom variable configuration.
 * @returns The value of the environment variable.
 */
export const getEnvVarFromConfig = async <TName extends string, TResult = string>(
  config: CustomVariableConfig<TName, TResult>,
): Promise<TResult> => {
  const variant = IS_CI ? "pipeline" : "local";
  return await config[variant](config);
};

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
