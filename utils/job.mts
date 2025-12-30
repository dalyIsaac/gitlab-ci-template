import { type CI_PIPELINE_SOURCE, getPipelineSource, PIPELINE_CONFIGS } from "./pipeline.mts";

/**
 * The main function for a job, handling pipeline source validation and setup.
 *
 * @param sources Accepted pipeline sources.
 * @param fn The main function to execute for the job.
 */
export async function jobMain<TSources extends readonly CI_PIPELINE_SOURCE[] = readonly CI_PIPELINE_SOURCE[]>(
  sources: TSources,
  fn: (arg: JobMainArg<TSources[number]>) => Promise<void>,
) {
  const source = getPipelineSource(...sources);
  const pipeline = PIPELINE_CONFIGS[source];

  await fn({ source, pipeline });
}

interface JobMainArg<TSource extends keyof typeof PIPELINE_CONFIGS> {
  /**
   * The current pipeline source. For more, see {@link CI_PIPELINE_SOURCE}.
   */
  source: TSource;

  /**
   * The pipeline configuration for the current source. The configuration will include the environment
   * variables available for this source.
   */
  pipeline: (typeof PIPELINE_CONFIGS)[TSource];
}

/**
 * The argument type for the `jobMain` function, based on the pipeline source.
 */
export type GetJobMainArg<TSource extends keyof typeof PIPELINE_CONFIGS> = JobMainArg<TSource>;

/**
 * Used to track the stack depth for nested job sections.
 */
let nesting = 0;

const SEPARATOR = "================================";

export async function jobSection<TResult>(name: string, fn: () => Promise<TResult>): Promise<TResult> {
  nesting += 1;

  const startTime = Date.now();

  jobLog(SEPARATOR);
  jobLog(`Starting job section: ${name}`);
  jobLog(`Start time: ${new Date(startTime).toISOString()}`);
  jobLog(SEPARATOR);

  const result = await fn();

  jobLog(SEPARATOR);
  const endTime = Date.now();
  jobLog(`Finished job section: ${name}`);
  jobLog(`End time: ${new Date(endTime).toISOString()}`);
  jobLog(`Duration: ${(endTime - startTime) / 1000} seconds`);
  jobLog(SEPARATOR);
  jobLog("\n");

  nesting -= 1;

  return result;
}

/**
 * Log a message with indentation based on the current nesting level.
 * The nesting level increases with each job section.
 *
 * @param message The message to log.
 */
export const jobLog = (message: string): void => {
  const messageLines = message.split("\n");
  for (const line of messageLines) {
    console.log(`${"  ".repeat(nesting)}${line}`);
  }
};
