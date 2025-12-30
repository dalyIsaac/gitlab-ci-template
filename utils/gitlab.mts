import type { PipelineConfig } from "./pipeline.mts";

/**
 * Populates a section in the GitLab merge request description with the given content.
 *
 * @param pipeline The pipeline configuration.
 * @param mergeRequestIid The IID of the merge request.
 * @param sectionTitle The title of the section to populate. Inside the markdown, this would be a
 * comment like `<!-- SECTION: sectionTitle -->`.
 * @param description The content to populate in the section.
 */
export const updateMergeRequestSection = async <TPipelineConfig extends PipelineConfig<"CI_PROJECT_ID">>(
  pipeline: TPipelineConfig,
  mergeRequestIid: number,
  sectionTitle: string,
  description: string,
): Promise<void> => {
  const mr = await pipeline.api.MergeRequests.show(pipeline.env.CI_PROJECT_ID, mergeRequestIid);

  const newDescription = createUpdatedMergeRequestDescriptionWithSection(mr.description || "", sectionTitle, description);

  await pipeline.api.MergeRequests.edit(pipeline.env.CI_PROJECT_ID, mergeRequestIid, {
    description: newDescription,
  });
};

export const createUpdatedMergeRequestDescriptionWithSection = (
  currentDescription: string,
  sectionTitle: string,
  description: string,
): string => {
  const sectionRegex = createMergeRequestDescriptionSectionRegex(sectionTitle);

  if (sectionRegex.test(currentDescription)) {
    return currentDescription.replace(sectionRegex, wrapDescriptionInSectionMarkers(sectionTitle, description));
  }

  return currentDescription + `\n\n` + wrapDescriptionInSectionMarkers(sectionTitle, description);
};

/**
 * Creates a regex to match a section in the merge request description identified by the given title.
 *
 * @param sectionTitle The title of the section.
 * @returns A regex that matches the section including its markers.
 */
export const createMergeRequestDescriptionSectionRegex = (sectionTitle: string) => {
  const sectionMarkerStart = createSectionMarkerStart(sectionTitle);
  const sectionMarkerEnd = createSectionMarkerEnd(sectionTitle);

  // Matches all whitespace and non-whitespace characters between the section markers.
  return new RegExp(`${sectionMarkerStart}([\\s\\S]*?)${sectionMarkerEnd}`, "g");
};

const createSectionMarkerStart = (sectionTitle: string) => `<!-- SECTION: ${sectionTitle} -->`;
const createSectionMarkerEnd = (sectionTitle: string) => `<!-- END SECTION: ${sectionTitle} -->`;

const wrapDescriptionInSectionMarkers = (sectionTitle: string, description: string) =>
  `${createSectionMarkerStart(sectionTitle)}\n${description}\n${createSectionMarkerEnd(sectionTitle)}`;
