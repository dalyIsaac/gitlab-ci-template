import { $, type ProcessPromise } from "zx";

export const SQUAWK_CONFIG: SquawkConfig = {
  preApproval: [
    {
      name: "All commits are GPG signed",
      script: () => $`check-gpg.mts`,
    },
    {
      name: "Developer has reviewed their changes",
      userInputType: "boolean",
    },
    {
      name: "Developer has updated merge request description",
      script: () => $`check-mr-description.mts`,
    },
  ],
  postApproval: [
    {
      name: "Has run System Tests on the branch HEAD",
      script: () => $`check-system-tests.mts`,
    },
  ],
};

export interface SquawkConfig {
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
   * This should throw an error if the check fails.
   */
  script?: () => Promise<void> | ProcessPromise;

  /**
   * Whether this check can be ignored by the user and CI.
   */
  canIgnore?: boolean;
}
