import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe.each(["ci.yml", "preview-retire.yml"])("%s", (name) => {
  const workflow = readFileSync(`.github/workflows/${name}`, "utf8");

  it("installs pnpm before each Wrangler action that selects it", () => {
    const jobs = workflow.split(/\n {2}[\w-]+:\n/);
    const pnpmJobs = jobs.filter((job) => job.includes("packageManager: pnpm"));

    expect(pnpmJobs.length).toBeGreaterThan(0);
    for (const job of pnpmJobs) {
      const setup = job.indexOf("pnpm/action-setup@");
      const wrangler = job.indexOf("cloudflare/wrangler-action@");
      expect(setup).toBeGreaterThanOrEqual(0);
      expect(wrangler).toBeGreaterThan(setup);
    }
  });
});
