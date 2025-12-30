import { updateMergeRequestSection } from "../../utils/gitlab.mts";
import { jobLog, jobMain } from "../../utils/job.mts";
import { ALL_CI_PIPELINE_SOURCES, type PipelineConfig } from "../../utils/pipeline.mts";
import { getExistingResultsTable, runAllChecks, summarizeCheckResults } from "./squawk-utils.mts";

const SECTION_TITLE = "squawk-check-results";

jobMain(ALL_CI_PIPELINE_SOURCES, async ({ source, pipeline }) => {
  const mergeRequestIid = await getMergeRequestIid(pipeline);
  const mr = await pipeline.api.MergeRequests.show(pipeline.env.CI_PROJECT_ID, mergeRequestIid);

  const existingResults = getExistingResultsTable(mr.description ?? "");
  const allResults = await runAllChecks(pipeline, existingResults);
  const resultsTable = await summarizeCheckResults(allResults);

  jobLog("Squawk Check Results:\n" + resultsTable);

  try {
    const mergeRequestSection = `### Squawk Check Results` + `\n\n` + resultsTable;
    await updateMergeRequestSection(pipeline, mergeRequestIid, SECTION_TITLE, mergeRequestSection);
  } catch (error) {
    jobLog(`Failed to populate merge request section: ${(error as Error).message}`);
  } finally {
    const failedChecks = allResults.filter((result) => !result.passed && !result.check.canIgnore);
    if (failedChecks.length > 0) {
      throw new Error(`Squawk checks failed: ${failedChecks.map((c) => c.check.name).join(", ")}`);
    }
  }
});

async function getMergeRequestIid(pipeline: PipelineConfig<"CI_PROJECT_ID" | "CI_COMMIT_REF_NAME">): Promise<number> {
  if ("CI_MERGE_REQUEST_IID" in pipeline.env) {
    return await pipeline.env.CI_MERGE_REQUEST_IID();
  }

  // Check the API for the MR associated with this pipeline.
  const projectId = pipeline.env.CI_PROJECT_ID;
  const refName = await pipeline.env.CI_COMMIT_REF_NAME();

  const mrs = await pipeline.api.MergeRequests.all({
    projectId,
    sourceBranch: refName,
    state: "opened",
  });

  const first = mrs[0];

  if (first === undefined) {
    throw new Error(`No open merge request found for branch "${refName}".`);
  }

  return first.iid;
}
