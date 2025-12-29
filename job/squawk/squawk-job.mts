import { $ } from "zx";
import { jobLog, jobMain, jobSection } from "../../utils/job.mts";
import { ALL_CI_PIPELINE_SOURCES } from "../../utils/pipeline.mts";
import { SQUAWK_CONFIG, type SquawkCheck } from "./squawk-config.mts";

jobMain(ALL_CI_PIPELINE_SOURCES, async ({ source, pipeline }) => {
  const preApprovalResults = await runMultipleChecks(
    SQUAWK_CONFIG.preApproval,
    "Pre-Approval"
  );

  if ("CI_MERGE_REQUEST_APPROVED" in pipeline.env) {
    const mrApproved = pipeline.env.CI_MERGE_REQUEST_APPROVED;

    if (mrApproved) {
      const postApprovalResults = await runMultipleChecks(
        SQUAWK_CONFIG.postApproval,
        "Post-Approval"
      );
    }
  }

  // TODO: Summarize the results and post to the merge request.
});

async function runMultipleChecks(
  checks: SquawkCheck[],
  checkType: "Pre-Approval" | "Post-Approval"
): Promise<SquawkCheckResult[]> {
  const results: SquawkCheckResult[] = [];

  await jobSection(`Squawk ${checkType} Checks`, async () => {
    for (const check of checks) {
      try {
        await runCheck(check);
        results.push({ check, passed: true });
        jobLog(`Check "${check.name}" passed.`);
      } catch (error) {
        results.push({ check, passed: false });
        jobLog(
          `Check "${check.name}" failed${
            check.canIgnore ? ", but was ignored." : "."
          }`
        );
      }
    }
  });

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
