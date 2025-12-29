import { jobMain, jobSection } from "../utils/job.mts";

jobMain(["merge_request_event", "push"], async ({ source, pipeline }) => {
  const refName = await pipeline.env.CI_COMMIT_REF_NAME();

  await jobSection("Print Branch Name", async () => {
    console.log(`Current branch: ${refName}`);
  });
});
