import { describe, expect, it } from "vitest";
import { createMarkdownTable } from "./markdown.mts";

describe("createMarkdownTable", () => {
  it("should create a basic markdown table", () => {
    // Given
    const items = [
      { name: "Alice", age: 30, active: true },
      { name: "Bob", age: 25, active: false },
    ];
    const columns = ["name", "age", "active"] as ("name" | "age" | "active")[];

    // When
    const result = createMarkdownTable(items, columns);

    // Then
    const expected = [
      // Extraneous comment to force formatting.
      "| name  | age | active |",
      "| ----- | --- | ------ |",
      "| Alice | 30  | true   |",
      "| Bob   | 25  | false  |",
    ].join("\n");
    expect(result).toBe(expected);
  });

  it("should handle empty items array", () => {
    // Given
    const items: { name: string; age: number }[] = [];
    const columns = ["name", "age"] as ("name" | "age")[];

    // When
    const result = createMarkdownTable(items, columns);

    // Then
    const expected = ["| name | age |", "| ---- | --- |"].join("\n");
    expect(result).toBe(expected);
  });

  it("should handle undefined and null values", () => {
    // Given
    const items = [
      { name: "Alice", age: 30, email: undefined },
      { name: "Bob", age: null, email: "bob@example.com" },
    ];
    const columns = ["name", "age", "email"] as ("name" | "age" | "email")[];

    // When
    const result = createMarkdownTable(items, columns);

    // Then
    const expected = [
      "| name  | age | email           |",
      "| ----- | --- | --------------- |",
      "| Alice | 30  |                 |",
      "| Bob   |     | bob@example.com |",
    ].join("\n");
    expect(result).toBe(expected);
  });

  it("should calculate column widths based on content", () => {
    // Given
    const items = [
      { id: 1, description: "Short" },
      { id: 999, description: "Very long description text" },
    ];
    const columns = ["id", "description"] as ("id" | "description")[];

    // When
    const result = createMarkdownTable(items, columns);

    // Then
    const expected = [
      "| id  | description                |",
      "| --- | -------------------------- |",
      "| 1   | Short                      |",
      "| 999 | Very long description text |",
    ].join("\n");
    expect(result).toBe(expected);
  });

  it("should calculate column widths based on header when header is longer", () => {
    // Given
    const items = [{ veryLongColumnName: "a" }, { veryLongColumnName: "b" }];
    const columns = ["veryLongColumnName"] as "veryLongColumnName"[];

    // When
    const result = createMarkdownTable(items, columns);

    // Then
    const expected = ["| veryLongColumnName |", "| ------------------ |", "| a                  |", "| b                  |"].join("\n");
    expect(result).toBe(expected);
  });

  it("should handle different data types", () => {
    // Given
    const items = [
      { str: "text", num: 42, bool: true },
      { str: "more text", num: 0, bool: false },
    ];
    const columns = ["str", "num", "bool"] as ("str" | "num" | "bool")[];

    // When
    const result = createMarkdownTable(items, columns);

    // Then
    const expected = [
      "| str       | num | bool  |",
      "| --------- | --- | ----- |",
      "| text      | 42  | true  |",
      "| more text | 0   | false |",
    ].join("\n");
    expect(result).toBe(expected);
  });

  it("should handle single column", () => {
    // Given
    const items = [{ name: "Alice" }, { name: "Bob" }];
    const columns = ["name"] as "name"[];

    // When
    const result = createMarkdownTable(items, columns);

    // Then
    const expected = ["| name  |", "| ----- |", "| Alice |", "| Bob   |"].join("\n");
    expect(result).toBe(expected);
  });

  it("should handle single row", () => {
    // Given
    const items = [{ name: "Alice", age: 30 }];
    const columns = ["name", "age"] as ("name" | "age")[];

    // When
    const result = createMarkdownTable(items, columns);

    // Then
    const expected = ["| name  | age |", "| ----- | --- |", "| Alice | 30  |"].join("\n");
    expect(result).toBe(expected);
  });

  it("should pad columns correctly for alignment", () => {
    // Given
    const items = [
      { a: "x", b: "short", c: "y" },
      { a: "longer", b: "mid", c: "even longer text" },
    ];
    const columns = ["a", "b", "c"] as ("a" | "b" | "c")[];

    // When
    const result = createMarkdownTable(items, columns);

    // Then
    const lines = result.split("\n");
    // Check that all lines have the same length
    const lengths = lines.map((line) => line.length);
    expect(lengths[0]).toBe(lengths[1]);
    expect(lengths[0]).toBe(lengths[2]);
    expect(lengths[0]).toBe(lengths[3]);
  });

  it("should handle empty string values", () => {
    // Given
    const items = [
      { name: "", value: "data" },
      { name: "test", value: "" },
    ];
    const columns = ["name", "value"] as ("name" | "value")[];

    // When
    const result = createMarkdownTable(items, columns);

    // Then
    const expected = ["| name | value |", "| ---- | ----- |", "|      | data  |", "| test |       |"].join("\n");
    expect(result).toBe(expected);
  });
});
