import { $ } from "zx";
import { createMergeRequestDescriptionSectionRegex } from "../../utils/gitlab.mts";
import { jobLog } from "../../utils/job.mts";
import { createMarkdownTable } from "../../utils/markdown.mts";
import { SQUAWK_CONFIG, type SquawkCheck } from "./squawk-config.mts";

const SECTION_TITLE = "squawk-check-results";

/**
 * Extracts the existing results table from the merge request description.
 *
 * @param mrDescription The merge request description text.
 * @returns An array of existing results parsed from the markdown table.
 */
export function getExistingResultsTable(mrDescription: string): UserInputResult[] {
  const regex = createMergeRequestDescriptionSectionRegex(SECTION_TITLE);
  const match = regex.exec(mrDescription);
  const resultsTable = match?.[1];

  if (resultsTable === undefined) {
    return [];
  }

  const lines = resultsTable.trim().split("\n");

  // Find the separator row (contains dashes and pipes).
  let dataStartIndex = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line && line.includes("---")) {
      dataStartIndex = i + 1;
      break;
    }
  }

  // Parse each line into columns.
  const results: UserInputResult[] = [];

  for (let i = dataStartIndex; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }

    const columns = line
      .split("|")
      .map((col) => col.trim())
      .filter((col) => col.length > 0);

    const [name, status] = columns;

    if (name && status) {
      results.push({
        name,
        status,
      });
    }
  }

  return results;
}

/**
 * A user input check result parsed from the merge request description.
 */
export interface UserInputResult {
  name: string;
  status: string;
}

/**
 * Runs all squawk checks based on the provided pipeline and user input results.
 * @param pipeline The pipeline configuration.
 * @param userInputResults The user input results from the merge request description.
 * @returns A promise that resolves to an array of squawk check results.
 */
export async function runAllChecks(pipeline: any, userInputResults: UserInputResult[]): Promise<SquawkCheckResult[]> {
  const preApprovalResults = await runMultipleChecks(SQUAWK_CONFIG.preApproval, userInputResults);

  let postApprovalResults: SquawkCheckResult[] = [];
  if ("CI_MERGE_REQUEST_APPROVED" in pipeline.env) {
    const isApproved = await pipeline.env.CI_MERGE_REQUEST_APPROVED();
    if (isApproved) {
      postApprovalResults = await runMultipleChecks(SQUAWK_CONFIG.postApproval, userInputResults);
    } else {
      jobLog("Merge request not approved; skipping post-approval checks.");
    }
  }

  return [...preApprovalResults, ...postApprovalResults];
}

/**
 * Runs multiple squawk checks sequentially.
 * @param checks The squawk checks to run.
 * @param userInputResults The user input results from the merge request description.
 * @returns A promise that resolves to an array of squawk check results.
 */
async function runMultipleChecks(checks: SquawkCheck[], userInputResults: UserInputResult[]): Promise<SquawkCheckResult[]> {
  const results: SquawkCheckResult[] = [];

  for (const check of checks) {
    try {
      await runCheck(check, userInputResults);
      results.push({ check, passed: true });
      jobLog(`Check "${check.name}" passed.`);
    } catch (error) {
      results.push({ check, passed: false, error: error as Error });
      jobLog(`Check "${check.name}" failed${check.canIgnore ? ", but was ignored." : "."}`);
    }
  }

  return results;
}

/**
 * The result of running a squawk check.
 */
export interface SquawkCheckResult {
  check: SquawkCheck;
  passed: boolean;
  userInput?: string | boolean | undefined;
  error?: Error;
}

/**
 * Runs a single squawk check.
 *
 * @param check The squawk check to run.
 * @param userInputResults The user input results from the merge request description.
 * @returns A promise that resolves to the squawk check result.
 */
async function runCheck(check: SquawkCheck, userInputResults: UserInputResult[]): Promise<SquawkCheckResult> {
  if (check.script) {
    await $`${check.script}`;
    return { check, passed: true };
  }

  const matchingResult = userInputResults.find((result) => result.name === check.name);
  const status = matchingResult?.status;

  if (check.userInputType === "boolean") {
    return {
      check,
      passed: status?.includes("✅") || status?.toLowerCase().includes("passed") || status?.toLowerCase().includes("true") ? true : false,
      userInput: status,
    };
  }

  if (check.userInputType === "string") {
    return {
      check,
      passed: status !== undefined && status.length > 0,
      userInput: status,
    };
  }

  throw new Error(`No script or userInputType defined for check "${check.name}".`);
}

/**
 * Summarizes the squawk check results into a markdown table.
 *
 * @param results The squawk check results to summarize.
 * @returns A promise that resolves to the markdown table string.
 */
export async function summarizeCheckResults(results: SquawkCheckResult[]): Promise<string> {
  const resultsTable = createMarkdownTable(
    results.map((result) => {
      let status = "";

      if (result.error) {
        status = `❌ Failed - ${result.error.message}`;
      } else if (result.userInput !== undefined) {
        status = `ℹ️ ${result.userInput}`;
      } else if (result.passed) {
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
