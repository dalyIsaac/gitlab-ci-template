import { getPipelineSource, PIPELINE_CONFIGS } from "../utils/pipeline";

const pipelineSource = getPipelineSource("merge_request_event", "push");
const pipeline = PIPELINE_CONFIGS[pipelineSource];

const refName = await pipeline.env.CI_COMMIT_REF_NAME();
console.log(`Current branch: ${refName}`);
