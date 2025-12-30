import { Gitlab } from "@gitbeaker/rest";
import { env } from "./env-utils.mts";
import { ENV_VARS_MAP, getPipelineEnvVars } from "./env-vars.mts";

const COMMON_CI_ENV_VARS = ["CI_PROJECT_ID", "CI_COMMIT_REF_NAME", "CI_PIPELINE_IID"] as const;

const api = new Gitlab({
  host: env("CI_API_V4_URL"),
  jobToken: env("CI_JOB_TOKEN"),
});

/**
 * The configurations for different pipeline sources.
 */
export const PIPELINE_CONFIGS = {
  merge_request_event: {
    env: getPipelineEnvVars(...COMMON_CI_ENV_VARS, "CI_MERGE_REQUEST_APPROVED"),
    api,
  },
  push: {
    env: getPipelineEnvVars(...COMMON_CI_ENV_VARS),
    api,
  },
  local: {
    env: {},
    api,
  },
} as const satisfies Partial<PipelineConfigMap>;

type PipelineConfigMap = Record<CI_PIPELINE_SOURCE, PipelineConfig<any>>;

/**
 * Configuration for a pipeline, specifying which environment variables are required.
 *
 * @template TEnvVarKeys - The names of environment variables that are required for this pipeline.
 * Defaults to `never`, meaning no environment variables are required by default. This allows each
 * specific pipeline configuration to specify exactly which environment variables it provides.
 * When using `PipelineConfig<"CI_PROJECT_ID">`, `CI_PROJECT_ID` will be a required, non-optional
 * property on the `env` object.
 */
export interface PipelineConfig<TEnvVarKeys extends keyof typeof ENV_VARS_MAP = never> {
  /**
   * The environment variables available in this pipeline.
   */
  env: Pick<typeof ENV_VARS_MAP, TEnvVarKeys> & Partial<Pick<typeof ENV_VARS_MAP, Exclude<keyof typeof ENV_VARS_MAP, TEnvVarKeys>>>;

  /**
   * The GitLab API client.
   */
  api: InstanceType<typeof Gitlab>;
}

/**
 * A subset of the possible CI_PIPELINE_SOURCE values from https://docs.gitlab.com/ci/jobs/job_rules/#ci_pipeline_source-predefined-variable.
 */
export const ALL_CI_PIPELINE_SOURCES = ["merge_request_event", "push", "local"] as const;

/**
 * A subset of the possible CI_PIPELINE_SOURCE values from https://docs.gitlab.com/ci/jobs/job_rules/#ci_pipeline_source-predefined-variable.
 */
export type CI_PIPELINE_SOURCE = (typeof ALL_CI_PIPELINE_SOURCES)[number];

const CI_PIPELINE_SOURCE = env("CI_PIPELINE_SOURCE") as CI_PIPELINE_SOURCE;

/**
 * Gets the current pipeline source, ensuring it is one of the accepted sources.
 *
 * @param accepts The accepted pipeline sources.
 * @returns The current pipeline source.
 * @throws If the current pipeline source is not in the accepted sources.
 */
export function getPipelineSource<TSources extends readonly CI_PIPELINE_SOURCE[] = readonly CI_PIPELINE_SOURCE[]>(
  ...accepts: TSources
): TSources[number] {
  if (!accepts.includes(CI_PIPELINE_SOURCE)) {
    throw new Error(`Invalid pipeline source: ${CI_PIPELINE_SOURCE}. Expected one of: ${accepts.join(", ")}`);
  }

  return CI_PIPELINE_SOURCE as TSources[number];
}
