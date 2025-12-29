import {
  type CI_PIPELINE_SOURCE,
  getPipelineSource,
  PIPELINE_CONFIGS,
} from "./pipeline.mts";

export async function jobMain<
  TSources extends readonly CI_PIPELINE_SOURCE[] = readonly CI_PIPELINE_SOURCE[]
>(sources: TSources, fn: (arg: JobMainArg<TSources[number]>) => Promise<void>) {
  const source = getPipelineSource(...sources);
  const pipeline = PIPELINE_CONFIGS[source];

  return await fn({ source, pipeline });
}

interface JobMainArg<TSource extends keyof typeof PIPELINE_CONFIGS> {
  source: TSource;
  pipeline: (typeof PIPELINE_CONFIGS)[TSource];
}

const SEPARATOR = "================================";

export const jobSection = async (name: string, fn: () => Promise<void>) => {
  const startTime = Date.now();

  console.log(SEPARATOR);
  console.log(`Starting job section: ${name}`);
  console.log(`Start time: ${new Date(startTime).toISOString()}`);
  console.log(SEPARATOR);

  await fn();

  console.log(SEPARATOR);
  const endTime = Date.now();
  console.log(`Finished job section: ${name}`);
  console.log(`End time: ${new Date(endTime).toISOString()}`);
  console.log(`Duration: ${(endTime - startTime) / 1000} seconds`);
  console.log(SEPARATOR);
  console.log("\n");
};
