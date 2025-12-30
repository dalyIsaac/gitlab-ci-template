import { $ } from "zx";
import { populateGitLabMergeRequestSection } from "../../utils/gitlab.mts";
import { jobLog, jobMain, type GetJobMainArg } from "../../utils/job.mts";
import { createMarkdownTable } from "../../utils/markdown.mts";
import { ALL_CI_PIPELINE_SOURCES, type PipelineConfig } from "../../utils/pipeline.mts";
import { SQUAWK_CONFIG, type SquawkCheck } from "./squawk-config.mts";

jobMain(ALL_CI_PIPELINE_SOURCES, async ({ source, pipeline }) => {
  const allResults = await runAllChecks(pipeline);
  const resultsTable = await summarizeCheckResults(allResults);

  jobLog("Squawk Check Results:\n" + resultsTable);

  try {
    const mergeRequestIid = await getMergeRequestIid(pipeline);
    const mergeRequestSection = `### Squawk Check Results` + `\n\n` + resultsTable;
    await populateGitLabMergeRequestSection(pipeline, mergeRequestIid, "squawk-check-results", mergeRequestSection);
  } catch (error) {
    jobLog(`Failed to populate merge request section: ${(error as Error).message}`);
  } finally {
    const failedChecks = allResults.filter((result) => !result.passed && !result.check.canIgnore);
    if (failedChecks.length > 0) {
      throw new Error(`Squawk checks failed: ${failedChecks.map((c) => c.check.name).join(", ")}`);
    }
  }
});

async function runAllChecks(pipeline: GetJobMainArg<(typeof ALL_CI_PIPELINE_SOURCES)[number]>["pipeline"]): Promise<SquawkCheckResult[]> {
  const preApprovalResults = await runMultipleChecks(SQUAWK_CONFIG.preApproval);

  let postApprovalResults: SquawkCheckResult[] = [];
  if ("CI_MERGE_REQUEST_APPROVED" in pipeline.env) {
    const isApproved = await pipeline.env.CI_MERGE_REQUEST_APPROVED();
    if (isApproved) {
      postApprovalResults = await runMultipleChecks(SQUAWK_CONFIG.postApproval);
    } else {
      jobLog("Merge request not approved; skipping post-approval checks.");
    }
  }

  return [...preApprovalResults, ...postApprovalResults];
}

async function runMultipleChecks(checks: SquawkCheck[]): Promise<SquawkCheckResult[]> {
  const results: SquawkCheckResult[] = [];

  for (const check of checks) {
    try {
      await runCheck(check);
      results.push({ check, passed: true });
      jobLog(`Check "${check.name}" passed.`);
    } catch (error) {
      results.push({ check, passed: false });
      jobLog(`Check "${check.name}" failed${check.canIgnore ? ", but was ignored." : "."}`);
    }
  }

  return results;
}

interface SquawkCheckResult {
  check: SquawkCheck;
  passed: boolean;
  error?: Error;
}

async function runCheck(check: SquawkCheck): Promise<void> {
  if (check.script) {
    await $`${check.script}`;
    return;
  }

  if (check.userInputType === "boolean") {
    // TODO: Check the MR description for a confirmation.
    return;
  }

  if (check.userInputType === "string") {
    // TODO: Check the MR description for a string.
    return;
  }
}

async function summarizeCheckResults(results: SquawkCheckResult[]): Promise<string> {
  const resultsTable = createMarkdownTable(
    results.map((result) => {
      let status = "";

      if (result.passed) {
        status = "✅ Passed";
      } else if (result.check.canIgnore) {
        status = "⚠️ Ignored";
      } else {
        status = "❌ Failed";
      }
      return {
        name: result.check.name,
        status,
      };
    }),
    ["name", "status"],
  );

  return resultsTable;
}

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
