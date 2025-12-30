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
