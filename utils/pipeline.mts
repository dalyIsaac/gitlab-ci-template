import { getPipelineEnvVars, ENV_VARS_MAP, env } from "./env.mts";

const COMMON_ENV_VARS = ["CI_COMMIT_REF_NAME", "CI_PIPELINE_IID"] as const;

/**
 * The configurations for different pipeline sources.
 */
export const PIPELINE_CONFIGS = {
  merge_request_event: {
    env: getPipelineEnvVars(...COMMON_ENV_VARS, "CI_MERGE_REQUEST_APPROVED"),
  },
  push: {
    env: getPipelineEnvVars(...COMMON_ENV_VARS),
  },
  local: { env: {} },
} as const satisfies Partial<PipelineConfigMap>;

type PipelineConfigMap = Record<CI_PIPELINE_SOURCE | "local", PipelineConfig>;

interface PipelineConfig {
  env: Partial<typeof ENV_VARS_MAP>;
}

/**
 * A subset of the possible CI_PIPELINE_SOURCE values from https://docs.gitlab.com/ci/jobs/job_rules/#ci_pipeline_source-predefined-variable.
 */
export const ALL_CI_PIPELINE_SOURCES = ["merge_request_event", "push"] as const;

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
export function getPipelineSource<
  TSources extends readonly CI_PIPELINE_SOURCE[] = readonly CI_PIPELINE_SOURCE[]
>(...accepts: TSources): TSources[number] {
  if (!accepts.includes(CI_PIPELINE_SOURCE)) {
    throw new Error(
      `Invalid pipeline source: ${CI_PIPELINE_SOURCE}. Expected one of: ${accepts.join(
        ", "
      )}`
    );
  }

  return CI_PIPELINE_SOURCE as TSources[number];
}
