import { describe, expect, it } from "vitest";
import { createMergeRequestDescriptionSectionRegex, createUpdatedMergeRequestDescriptionWithSection } from "./gitlab.mts";

describe("createUpdatedMergeRequestDescriptionWithSection", () => {
  it("should add a new section when none exists", () => {
    // Given
    const currentDescription = "This is the existing description.";
    const sectionTitle = "Test Section";
    const newContent = "New section content";

    // When
    const result = createUpdatedMergeRequestDescriptionWithSection(currentDescription, sectionTitle, newContent);

    // Then
    const expected =
      currentDescription + "\n\n" + "<!-- SECTION: Test Section -->\n" + "New section content\n" + "<!-- END SECTION: Test Section -->";
    expect(result).toBe(expected);
  });

  it("should replace an existing section", () => {
    // Given
    const currentDescription =
      "This is the existing description.\n\n" + "<!-- SECTION: Test Section -->\n" + "Old content\n" + "<!-- END SECTION: Test Section -->";
    const sectionTitle = "Test Section";
    const newContent = "Updated content";

    // When
    const result = createUpdatedMergeRequestDescriptionWithSection(currentDescription, sectionTitle, newContent);

    // Then
    const expected =
      "This is the existing description.\n\n" +
      "<!-- SECTION: Test Section -->\n" +
      "Updated content\n" +
      "<!-- END SECTION: Test Section -->";
    expect(result).toBe(expected);
  });

  it("should handle empty current description", () => {
    // Given
    const currentDescription = "";
    const sectionTitle = "New Section";
    const newContent = "Content for new section";

    // When
    const result = createUpdatedMergeRequestDescriptionWithSection(currentDescription, sectionTitle, newContent);

    // Then
    const expected = "\n\n" + "<!-- SECTION: New Section -->\n" + "Content for new section\n" + "<!-- END SECTION: New Section -->";
    expect(result).toBe(expected);
  });

  it("should handle multiline content in section", () => {
    // Given
    const currentDescription = "Initial description";
    const sectionTitle = "Results";
    const newContent = "Line 1\nLine 2\nLine 3";

    // When
    const result = createUpdatedMergeRequestDescriptionWithSection(currentDescription, sectionTitle, newContent);

    // Then
    const expected =
      currentDescription + "\n\n" + "<!-- SECTION: Results -->\n" + "Line 1\nLine 2\nLine 3\n" + "<!-- END SECTION: Results -->";
    expect(result).toBe(expected);
  });

  it("should handle special characters in section title", () => {
    // Given
    const currentDescription = "Description with section";
    const sectionTitle = "Section-With_Special.Chars";
    const newContent = "Some content";

    // When
    const result = createUpdatedMergeRequestDescriptionWithSection(currentDescription, sectionTitle, newContent);

    // Then
    expect(result).toContain("<!-- SECTION: Section-With_Special.Chars -->");
    expect(result).toContain("<!-- END SECTION: Section-With_Special.Chars -->");
    expect(result).toContain("Some content");
  });

  it("should preserve multiple different sections", () => {
    // Given
    const currentDescription =
      "Description\n\n" +
      "<!-- SECTION: Section1 -->\n" +
      "Content 1\n" +
      "<!-- END SECTION: Section1 -->\n\n" +
      "Middle text\n\n" +
      "<!-- SECTION: Section2 -->\n" +
      "Content 2\n" +
      "<!-- END SECTION: Section2 -->";
    const sectionTitle = "Section1";
    const newContent = "Updated Content 1";

    // When
    const result = createUpdatedMergeRequestDescriptionWithSection(currentDescription, sectionTitle, newContent);

    // Then
    expect(result).toContain("<!-- SECTION: Section1 -->\nUpdated Content 1\n<!-- END SECTION: Section1 -->");
    expect(result).toContain("<!-- SECTION: Section2 -->\nContent 2\n<!-- END SECTION: Section2 -->");
    expect(result).toContain("Middle text");
  });

  it("should handle replacement with complex multiline content", () => {
    // Given
    const currentDescription = "Original description\n\n" + "<!-- SECTION: Logs -->\n" + "Old log content\n" + "<!-- END SECTION: Logs -->";
    const sectionTitle = "Logs";
    const newContent = "Error on line 5\nWarning on line 10\nSuccess message";

    // When
    const result = createUpdatedMergeRequestDescriptionWithSection(currentDescription, sectionTitle, newContent);

    // Then
    const expected =
      "Original description\n\n" +
      "<!-- SECTION: Logs -->\n" +
      "Error on line 5\nWarning on line 10\nSuccess message\n" +
      "<!-- END SECTION: Logs -->";
    expect(result).toBe(expected);
  });

  it("should handle empty content in section", () => {
    // Given
    const currentDescription = "Description";
    const sectionTitle = "Empty";
    const newContent = "";

    // When
    const result = createUpdatedMergeRequestDescriptionWithSection(currentDescription, sectionTitle, newContent);

    // Then
    const expected = "Description\n\n" + "<!-- SECTION: Empty -->\n" + "\n" + "<!-- END SECTION: Empty -->";
    expect(result).toBe(expected);
  });

  it("should correctly match section markers with regex special characters in title", () => {
    // Given
    const currentDescription =
      "Description\n\n" + "<!-- SECTION: Test.Section+Advanced -->\n" + "Old content\n" + "<!-- END SECTION: Test.Section+Advanced -->";
    const sectionTitle = "Test.Section+Advanced";
    const newContent = "New content";

    // When
    const result = createUpdatedMergeRequestDescriptionWithSection(currentDescription, sectionTitle, newContent);

    // Then
    expect(result).toContain("<!-- SECTION: Test.Section+Advanced -->\nNew content\n<!-- END SECTION: Test.Section+Advanced -->");
  });

  it("should handle section at the beginning of description", () => {
    // Given
    const currentDescription = "<!-- SECTION: Top -->\n" + "Old top content\n" + "<!-- END SECTION: Top -->\n\n" + "Rest of description";
    const sectionTitle = "Top";
    const newContent = "New top content";

    // When
    const result = createUpdatedMergeRequestDescriptionWithSection(currentDescription, sectionTitle, newContent);

    // Then
    const expected = "<!-- SECTION: Top -->\n" + "New top content\n" + "<!-- END SECTION: Top -->\n\n" + "Rest of description";
    expect(result).toBe(expected);
  });

  it("should handle content with newlines at the end of section", () => {
    // Given
    const currentDescription =
      "Start\n\n" + "<!-- SECTION: Test -->\n" + "Content with trailing newlines\n\n\n" + "<!-- END SECTION: Test -->";
    const sectionTitle = "Test";
    const newContent = "New content";

    // When
    const result = createUpdatedMergeRequestDescriptionWithSection(currentDescription, sectionTitle, newContent);

    // Then
    const expected = "Start\n\n" + "<!-- SECTION: Test -->\n" + "New content\n" + "<!-- END SECTION: Test -->";
    expect(result).toBe(expected);
  });
});

describe("createMergeRequestDescriptionSectionRegex", () => {
  it.each([
    [
      "Test Section",
      "Some text before\n\n<!-- SECTION: Test Section -->\nSection content\n<!-- END SECTION: Test Section -->\n\nSome text after",
    ],
    ["Results", "<!-- SECTION: Results -->\nContent here\n<!-- END SECTION: Results -->"],
    ["Empty Section", "<!-- SECTION: Empty Section -->\n<!-- END SECTION: Empty Section -->"],
    ["Code", "<!-- SECTION: Code -->\nconst x = 1;\n<!-- END SECTION: Code -->"],
  ])("should match a section with title: %s", (sectionTitle, description) => {
    // When
    const regex = createMergeRequestDescriptionSectionRegex(sectionTitle);

    // Then
    expect(regex.test(description)).toBe(true);
  });

  it.each([
    ["Test Section", "<!-- SECTION: Different Section -->\nContent\n<!-- END SECTION: Different Section -->"],
    ["Results", "<!-- SECTION: NotResults -->\nContent\n<!-- END SECTION: NotResults -->"],
    ["MySection", "Some text without any section markers"],
  ])("should not match when section title does not exist: %s", (sectionTitle, description) => {
    // When
    const regex = createMergeRequestDescriptionSectionRegex(sectionTitle);

    // Then
    expect(regex.test(description)).toBe(false);
  });

  it("should match and capture section content", () => {
    // Given
    const sectionTitle = "Test Section";
    const description = "<!-- SECTION: Test Section -->\n" + "Section content\n" + "<!-- END SECTION: Test Section -->";
    const regex = createMergeRequestDescriptionSectionRegex(sectionTitle);

    // When
    const match = description.match(regex);

    // Then
    expect(match).not.toBeNull();
    expect(match![0]).toContain("Section content");
  });

  it("should match multiline content within a section", () => {
    // Given
    const sectionTitle = "Results";
    const description = "<!-- SECTION: Results -->\n" + "Line 1\n" + "Line 2\n" + "Line 3\n" + "<!-- END SECTION: Results -->";

    // When
    const regex = createMergeRequestDescriptionSectionRegex(sectionTitle);

    // Then
    expect(regex.test(description)).toBe(true);
    const match = description.match(regex);
    expect(match![0]).toContain("Line 1");
    expect(match![0]).toContain("Line 2");
    expect(match![0]).toContain("Line 3");
  });

  it("should match section with empty content", () => {
    // Given
    const sectionTitle = "Empty Section";
    const description = "<!-- SECTION: Empty Section -->\n" + "<!-- END SECTION: Empty Section -->";

    // When
    const regex = createMergeRequestDescriptionSectionRegex(sectionTitle);

    // Then
    expect(regex.test(description)).toBe(true);
  });

  it("should use global flag for matching multiple sections", () => {
    // Given
    const sectionTitle = "Repeating";
    const description =
      "<!-- SECTION: Repeating -->\n" +
      "First\n" +
      "<!-- END SECTION: Repeating -->\n\n" +
      "<!-- SECTION: Repeating -->\n" +
      "Second\n" +
      "<!-- END SECTION: Repeating -->";

    // When
    const regex = createMergeRequestDescriptionSectionRegex(sectionTitle);
    const matches = description.match(regex);

    // Then
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
  });

  it("should use non-greedy matching to match shortest content", () => {
    // Given
    const sectionTitle = "Test";
    const description =
      "<!-- SECTION: Test -->\n" +
      "Content 1\n" +
      "<!-- END SECTION: Test -->\n\n" +
      "<!-- SECTION: Test -->\n" +
      "Content 2\n" +
      "<!-- END SECTION: Test -->";

    // When
    const regex = createMergeRequestDescriptionSectionRegex(sectionTitle);
    const matches = description.match(regex);

    // Then
    expect(matches!.length).toBe(2);
    expect(matches![0]).not.toContain("Content 2");
    expect(matches![1]).not.toContain("Content 1");
  });

  it.each(["const x = /[a-z]+/g;", "console.log('(test)');", "if (x > 0 && y < 10) {}", "match: [a-z]{2,5}"])(
    "should match content with special regex characters: %s",
    (content) => {
      // Given
      const sectionTitle = "Code";
      const description = `<!-- SECTION: ${sectionTitle} -->\n` + `${content}\n` + `<!-- END SECTION: ${sectionTitle} -->`;

      // When
      const regex = createMergeRequestDescriptionSectionRegex(sectionTitle);

      // Then
      expect(regex.test(description)).toBe(true);
      const match = description.match(regex);
      expect(match![0]).toContain(content);
    },
  );

  it("should match section with leading and trailing whitespace", () => {
    // Given
    const sectionTitle = "Whitespace";
    const description =
      "<!-- SECTION: Whitespace -->\n" + "  Content with spaces  \n" + "  More content\n" + "<!-- END SECTION: Whitespace -->";

    // When
    const regex = createMergeRequestDescriptionSectionRegex(sectionTitle);

    // Then
    expect(regex.test(description)).toBe(true);
    const match = description.match(regex);
    expect(match![0]).toContain("Content with spaces");
  });

  it.each([
    "<!-- SECTION: Test \nContent\n<!-- END SECTION: Test",
    "<!-- SECTION: Test -->\nContent",
    "Content\n<!-- END SECTION: Test -->",
  ])("should not match partial section markers: %s", (description) => {
    // When
    const regex = createMergeRequestDescriptionSectionRegex("Test");

    // Then
    expect(regex.test(description)).toBe(false);
  });

  it("should match section with newlines at the end before marker", () => {
    // Given
    const sectionTitle = "Section";
    const description = "<!-- SECTION: Section -->\n" + "Content\n\n\n" + "<!-- END SECTION: Section -->";

    // When
    const regex = createMergeRequestDescriptionSectionRegex(sectionTitle);

    // Then
    expect(regex.test(description)).toBe(true);
    const match = description.match(regex);
    expect(match![0]).toContain("Content");
  });

  it("should handle section title case sensitivity", () => {
    // Given
    const sectionTitle = "Test";
    const description = "<!-- SECTION: test -->\n" + "Content\n" + "<!-- END SECTION: test -->";

    // When
    const regex = createMergeRequestDescriptionSectionRegex(sectionTitle);

    // Then
    expect(regex.test(description)).toBe(false);
  });

  it("should replace matched section content using regex", () => {
    // Given
    const sectionTitle = "Update";
    const originalDescription =
      "Before\n\n" + "<!-- SECTION: Update -->\n" + "Old content\n" + "<!-- END SECTION: Update -->\n\n" + "After";
    const newContent = "New content";

    // When
    const regex = createMergeRequestDescriptionSectionRegex(sectionTitle);
    const result = originalDescription.replace(
      regex,
      `<!-- SECTION: ${sectionTitle} -->\n${newContent}\n<!-- END SECTION: ${sectionTitle} -->`,
    );

    // Then
    expect(result).toContain("New content");
    expect(result).not.toContain("Old content");
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });
});
