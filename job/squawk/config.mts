import type { CI_PIPELINE_SOURCE } from "../../utils/pipeline.mts";

interface SquawkConfig {
  preApproval: Check[];
  postApproval: Check[];
}

interface Check {
  name: string;
  type?: "boolean" | "string";
  script?: string;
  canIgnore?: boolean;
  notifyOnFailure?: boolean;

  /**
   * The pipeline sources this check applies to. If not specified, applies to all pipeline sources.
   */
  pipelineSource?: CI_PIPELINE_SOURCE[];
}

export const SQUAWK_CONFIG: SquawkConfig = {
  preApproval: [
    {
      name: "All commits are GPG signed",
      script: "check-gpg.mts",
      canIgnore: false,
      notifyOnFailure: true,
    },
    {
      name: "Developer has reviewed their changes",
      type: "boolean",
      canIgnore: false,
    },
    {
      name: "Developer has updated merge request description",
      script: "check-mr-description.mts",
      canIgnore: false,
    },
  ],
  postApproval: [],
};
