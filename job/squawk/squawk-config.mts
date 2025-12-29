export const SQUAWK_CONFIG: SquawkConfig = {
  preApproval: [
    {
      name: "All commits are GPG signed",
      script: "check-gpg.mts",
      canIgnore: false,
    },
    {
      name: "Developer has reviewed their changes",
      userInputType: "boolean",
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

interface SquawkConfig {
  preApproval: SquawkCheck[];
  postApproval: SquawkCheck[];
}

export interface SquawkCheck {
  /**
   * The name of the check.
   */
  name: string;

  /**
   * The type of user input required for this check.
   * If not specified, no user input is required.
   */
  userInputType?: "boolean" | "string";

  /**
   * The script to run for this check. If this is specified, then {@link userInputType} is ignored.
   */
  script?: string;

  /**
   * Whether this check can be ignored by the user and CI.
   */
  canIgnore?: boolean;
}
