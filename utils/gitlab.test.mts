import { describe, expect, it } from "vitest";
import { createUpdatedMergeRequestDescriptionWithSection } from "./gitlab.mts";

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
