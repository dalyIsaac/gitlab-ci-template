import { $ } from "zx";
import { jobLog, jobMain, jobSection } from "../../utils/job.mts";
import { ALL_CI_PIPELINE_SOURCES } from "../../utils/pipeline.mts";
import { SQUAWK_CONFIG, type SquawkCheck } from "./squawk-config.mts";

jobMain(ALL_CI_PIPELINE_SOURCES, async ({ source, pipeline }) => {
  const preApprovalResults = await jobSection("Squawk Pre-Approval Checks", () => runMultipleChecks(SQUAWK_CONFIG.preApproval));

  let postApprovalResults: SquawkCheckResult[] = [];

  if ("CI_MERGE_REQUEST_APPROVED" in pipeline.env) {
    const isApproved = await pipeline.env.CI_MERGE_REQUEST_APPROVED();
    if (isApproved) {
      postApprovalResults = await jobSection("Squawk Post-Approval Checks", () => runMultipleChecks(SQUAWK_CONFIG.postApproval));
    } else {
      jobLog("Merge request not approved; skipping post-approval checks.");
    }
  }

  // TODO: Summarize the results and post to the merge request.
});

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
