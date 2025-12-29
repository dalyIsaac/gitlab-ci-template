import { type CI_PIPELINE_SOURCE, getPipelineSource, PIPELINE_CONFIGS } from "./pipeline.mts";

export async function jobMain<TSources extends readonly CI_PIPELINE_SOURCE[] = readonly CI_PIPELINE_SOURCE[]>(
  sources: TSources,
  fn: (arg: JobMainArg<TSources[number]>) => Promise<void>,
) {
  const source = getPipelineSource(...sources);
  const pipeline = PIPELINE_CONFIGS[source];

  return await fn({ source, pipeline });
}

interface JobMainArg<TSource extends keyof typeof PIPELINE_CONFIGS> {
  source: TSource;
  pipeline: (typeof PIPELINE_CONFIGS)[TSource];
}

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
export const jobLog = (message: string): void => console.log(`${"  ".repeat(nesting)}${message}`);
