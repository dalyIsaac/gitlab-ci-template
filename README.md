# GitLab CI Template

This repository contains code snippets for setting up a GitLab CI/CD pipeline using [zx](https://github.com/google/zx) for scripting.

For example, a step in your `.gitlab-ci.yml` file could look like this:

```yaml
stages:
  - build

build_job:
  stage: build
  image: node:latest
  script:
    - npm ci
    - node job/example-job.mts
```

## Environment Variables

Environment variables are automatically made safe for different execution contexts:

- **In CI**: Environment variables are read directly from the GitLab CI environment.
- **Locally**: Safe fallback implementations can be provided. These are asynchronous functions that mimic the CI environment.

Environment variables are defined in [`utils/env-vars.mts`](utils/env-vars.mts), and pipelines define what variables are available in [`utils/pipeline.mts`](utils/pipeline.mts).

If an environment variable is not available, an error will be thrown. Environment variables are accessed via the `pipeline.env` object inside a `jobMain` - see the [example below](#example-job).

## Example Job

```typescript
import { jobMain, jobSection } from "../utils/job.mts";

// jobMain is the main function for the job, handling pipeline source validation
// and setup.
jobMain(["merge_request_event", "push"], async ({ source, pipeline }) => {
  // Get the current branch name. Getting the env var is async as when the
  // script is run locally, it can fetch the value from the shell.
  const refName = await pipeline.env.CI_COMMIT_REF_NAME();

  // jobSection is used to create an indented section in the job logs.
  // It will include the time taken to execute the section.
  await jobSection("Print Branch Name", async () => {
    console.log(`Current branch: ${refName}`);
  });
});
```

Also see [job/example-job.mts](job/example-job.mts) for a complete example.

## Squawk

[Squawk](job/squawk/squawk-job.mts) is a merge request quality gate system that enforces a series of checks before and after a merge request is approved.

### Features

- **Pre-approval checks**: Executed before the merge request is approved.
  - Can include automated scripts (GPG signature verification, description validation, etc.).
  - Can include user input requirements (boolean or string types).
- **Post-approval checks**: Executed only after the merge request is approved.
  - Typically used for integration tests or deployment preparation checks.
- **Markdown reporting**: Results are documented in the merge request description in a markdown table.
- **Flexible check configuration**: Define custom checks with scripts or user input requirements.
- **Ignorable checks**: Mark checks as optional (`canIgnore: true`) to allow graceful degradation.
- **User input handling**: Requires user confirmation in the squawk report of the merge request description.

### Configuration

Configure squawk checks in `job/squawk/squawk-config.mts`:

```typescript
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
  ],
  postApproval: [
    {
      name: "Has run System Tests",
      script: () => $`check-system-tests.mts`,
    },
  ],
};
```

Each check can have:

- `name`: Human-readable check name.
- `script`: Optional function that executes a check (returns `ProcessPromise`).
- `userInputType`: Optional "boolean" or "string" for manual approval.
- `canIgnore`: Optional boolean to allow the check to fail without blocking the MR.
