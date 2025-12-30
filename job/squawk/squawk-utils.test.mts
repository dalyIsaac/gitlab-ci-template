import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SquawkCheckResult, UserInputResult } from "./squawk-utils.mts";
import { getExistingResultsTable, runAllChecks, summarizeCheckResults } from "./squawk-utils.mts";

describe("getExistingResultsTable", () => {
  it("should return empty array when no section is found", () => {
    // Given
    const description = "Some other content without the section";

    // When
    const result = getExistingResultsTable(description);

    // Then
    expect(result).toEqual([]);
  });

  it("should parse existing results from a markdown table in the description", () => {
    // Given
    const description = `
Some intro text

<!-- SECTION: squawk-check-results -->
| name | status |
| --- | --- |
| Check A | ✅ Passed |
| Check B | ❌ Failed |
<!-- END SECTION: squawk-check-results -->

Some outro text
    `;

    // When
    const result = getExistingResultsTable(description);

    // Then
    expect(result).toEqual([
      { name: "Check A", status: "✅ Passed" },
      { name: "Check B", status: "❌ Failed" },
    ]);
  });

  it("should handle whitespace in table cells", () => {
    // Given
    const description = `<!-- SECTION: squawk-check-results -->
|   name   |   status   |
| --- | --- |
|  Check A  |  ✅ Passed  |
|  Check B  |  ⚠️ Ignored  |
<!-- END SECTION: squawk-check-results -->`;

    // When
    const result = getExistingResultsTable(description);

    // Then
    expect(result).toEqual([
      { name: "Check A", status: "✅ Passed" },
      { name: "Check B", status: "⚠️ Ignored" },
    ]);
  });

  it("should skip header and separator rows", () => {
    // Given
    const description = `<!-- SECTION: squawk-check-results -->
| name | status |
| --- | --- |
| Check 1 | ✅ Passed |
<!-- END SECTION: squawk-check-results -->`;

    // When
    const result = getExistingResultsTable(description);

    // Then
    // Should only have the data row, not the header or separator
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "Check 1", status: "✅ Passed" });
  });

  it("should handle empty description", () => {
    // Given
    const description = "";

    // When
    const result = getExistingResultsTable(description);

    // Then
    expect(result).toEqual([]);
  });

  it("should ignore incomplete rows", () => {
    // Given
    const description = `<!-- SECTION: squawk-check-results -->
| name | status |
| --- | --- |
| Only Name |
| Check B | ✅ Passed |
<!-- END SECTION: squawk-check-results -->`;

    // When
    const result = getExistingResultsTable(description);

    // Then
    expect(result).toEqual([{ name: "Check B", status: "✅ Passed" }]);
  });

  it("should handle multiple rows with various statuses", () => {
    // Given
    const description = `<!-- SECTION: squawk-check-results -->
| name | status |
| --- | --- |
| Check A | ✅ Passed |
| Check B | ❌ Failed - error message |
| Check C | ⚠️ Ignored |
| Check D | ℹ️ user input |
<!-- END SECTION: squawk-check-results -->`;

    // When
    const result = getExistingResultsTable(description);

    // Then
    expect(result).toEqual([
      { name: "Check A", status: "✅ Passed" },
      { name: "Check B", status: "❌ Failed - error message" },
      { name: "Check C", status: "⚠️ Ignored" },
      { name: "Check D", status: "ℹ️ user input" },
    ]);
  });
});

describe("runAllChecks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should run pre-approval checks when CI_MERGE_REQUEST_APPROVED is not in env", async () => {
    // Given
    const mockPipeline = {
      env: {
        // No CI_MERGE_REQUEST_APPROVED property.
      },
    } as any;

    const existingResults: UserInputResult[] = [];

    // When
    const result = await runAllChecks(mockPipeline, existingResults);

    // Then - verify it returns an array (checks were run)
    expect(Array.isArray(result)).toBe(true);
  }, 10_000);

  it("should run post-approval checks when merge request is approved", async () => {
    // Given
    const mockPipeline = {
      env: {
        CI_MERGE_REQUEST_APPROVED: vi.fn().mockResolvedValue(true),
      },
    } as any;

    const existingResults: UserInputResult[] = [];

    // When
    const result = await runAllChecks(mockPipeline, existingResults);

    // Then
    expect(Array.isArray(result)).toBe(true);
    expect(mockPipeline.env.CI_MERGE_REQUEST_APPROVED).toHaveBeenCalled();
  });

  it("should skip post-approval checks when merge request is not approved", async () => {
    // Given
    const mockPipeline = {
      env: {
        CI_MERGE_REQUEST_APPROVED: vi.fn().mockResolvedValue(false),
      },
    } as any;

    const existingResults: UserInputResult[] = [];

    // When
    const result = await runAllChecks(mockPipeline, existingResults);

    // Then
    expect(Array.isArray(result)).toBe(true);
    expect(mockPipeline.env.CI_MERGE_REQUEST_APPROVED).toHaveBeenCalled();
  });
});

describe("summarizeCheckResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a table with all passed checks", async () => {
    // Given
    const results: SquawkCheckResult[] = [
      {
        check: { name: "Check A", canIgnore: false },
        passed: true,
      },
      {
        check: { name: "Check B", canIgnore: false },
        passed: true,
      },
    ];

    // When
    const result = await summarizeCheckResults(results);

    // Then
    expect(result).toContain("Check A");
    expect(result).toContain("Check B");
    expect(result).toContain("✅ Passed");
  });

  it("should mark failed checks with error message", async () => {
    // Given
    const error = new Error("Script failed with exit code 1");
    const results: SquawkCheckResult[] = [
      {
        check: { name: "Check A", canIgnore: false },
        passed: false,
        error,
      },
    ];

    // When
    const result = await summarizeCheckResults(results);

    // Then
    expect(result).toContain("Check A");
    expect(result).toContain("❌ Failed");
    expect(result).toContain("Script failed with exit code 1");
  });

  it("should display user input for checks with userInput", async () => {
    // Given
    const results: SquawkCheckResult[] = [
      {
        check: { name: "Developer review", userInputType: "boolean", canIgnore: false },
        passed: true,
        userInput: "✅ Yes",
      },
    ];

    // When
    const result = await summarizeCheckResults(results);

    // Then
    expect(result).toContain("Developer review");
    expect(result).toContain("ℹ️");
    expect(result).toContain("✅ Yes");
  });

  it("should show ignored status for failed checks that can be ignored", async () => {
    // Given
    const results: SquawkCheckResult[] = [
      {
        check: { name: "Optional Check", canIgnore: true },
        passed: false,
      },
    ];

    // When
    const result = await summarizeCheckResults(results);

    // Then
    expect(result).toContain("Optional Check");
    expect(result).toContain("⚠️ Ignored");
  });

  it("should handle mixed check results", async () => {
    // Given
    const results: SquawkCheckResult[] = [
      {
        check: { name: "Passed Check", canIgnore: false },
        passed: true,
      },
      {
        check: { name: "Failed Check", canIgnore: false },
        passed: false,
        error: new Error("Failed"),
      },
      {
        check: { name: "Ignored Check", canIgnore: true },
        passed: false,
      },
      {
        check: { name: "User Input Check", userInputType: "boolean", canIgnore: false },
        passed: true,
        userInput: "Some input",
      },
    ];

    // When
    const result = await summarizeCheckResults(results);

    // Then
    expect(result).toContain("Passed Check");
    expect(result).toContain("✅ Passed");
    expect(result).toContain("Failed Check");
    expect(result).toContain("❌ Failed");
    expect(result).toContain("Ignored Check");
    expect(result).toContain("⚠️ Ignored");
    expect(result).toContain("User Input Check");
    expect(result).toContain("ℹ️");
  });

  it("should handle empty results array", async () => {
    // Given
    const results: SquawkCheckResult[] = [];

    // When
    const result = await summarizeCheckResults(results);

    // Then
    // Should return a markdown table with headers only
    expect(result).toContain("name");
    expect(result).toContain("status");
  });

  it("should handle boolean userInput values", async () => {
    // Given
    const results: SquawkCheckResult[] = [
      {
        check: { name: "Boolean Check", canIgnore: false },
        passed: true,
        userInput: true,
      },
    ];

    // When
    const result = await summarizeCheckResults(results);

    // Then
    expect(result).toContain("Boolean Check");
    expect(result).toContain("ℹ️");
    expect(result).toContain("true");
  });
});
