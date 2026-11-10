// "Accept a warning", run as the page shows it on a copy of the quality
// example: each list the page writes is added, the plan is run, and what it
// prints before the files is compared with the page.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { readExampleFile } from "../lib/examples.js";
import { cli, copy, fences, read, section } from "./pages.js";

const page = read("how-to/accept-a-warning.mdx");

/** Plans a project, which must succeed, and returns what it prints. */
function plan(cwd: string): string {
  const result = cli(cwd, ["plan", "--no-diff"]);
  expect(result.code, result.output).toBe(0);
  return result.output;
}

describe("how-to/accept-a-warning", () => {
  it("quotes the warning the quality example's synapse environment gives", () => {
    const warning = fences(page.split("\n## ")[0]!, "text")[0]!;
    expect(plan(copy("quality"))).toContain(warning);
  });

  it("accepts it for every environment, and reports the entry unused where it matches nothing", () => {
    const steps = section(page, "## Accept one warning [#accept]");
    const cwd = copy("quality");
    const platform = join(cwd, "platform.yaml");
    writeFileSync(platform, readFileSync(platform, "utf8") + fences(steps, "yaml")[0]!);
    const output = plan(cwd);
    expect(output.startsWith(fences(steps, "text")[0]!)).toBe(true);
    expect(output).not.toContain("The fail action");
  });

  it("accepts it in one environment through a value, with nothing unused", () => {
    const steps = section(page, "## Accept it in some environments only [#per-environment]");
    const [list, project] = fences(steps, "yaml");
    // The page's project.yaml is the example's, with the lists added.
    const shown = parse(project!);
    const example = parse(readExampleFile("quality", "project.yaml"));
    const { accept, ...synapse } = shown.environments.synapse.values;
    expect(accept).toHaveLength(1);
    expect(synapse).toEqual(example.environments.synapse.values);
    expect(shown.values).toEqual({ accept: [] });
    expect({ ...shown, values: undefined, environments: undefined }).toEqual({
      ...example,
      values: undefined,
      environments: undefined,
    });
    // The same entry the page accepted for every environment.
    expect(accept).toEqual(
      parse(fences(section(page, "## Accept one warning [#accept]"), "yaml")[0]!).accept,
    );
    const cwd = copy("quality");
    const platform = join(cwd, "platform.yaml");
    writeFileSync(platform, readFileSync(platform, "utf8") + list!);
    writeFileSync(join(cwd, "project.yaml"), project!);
    const output = plan(cwd);
    expect(output.startsWith(fences(steps, "text")[0]!)).toBe(true);
    expect(output).not.toContain("ACCEPT_UNUSED");
  });

  it("refuses a code that is no longer reported", () => {
    const cwd = copy("quality");
    const platform = join(cwd, "platform.yaml");
    writeFileSync(
      platform,
      `${readFileSync(platform, "utf8")}accept:\n  - code: CONTRACT_FIELD_UNUSED\n    reason: Old.\n`,
    );
    const result = cli(cwd, ["plan", "--no-diff"]);
    expect(result.code).toBe(1);
    expect(result.output).toContain("error  ACCEPT_CODE");
    expect(section(page, "## Say which warnings [#about]")).toContain("`CONTRACT_FIELD_UNUSED`");
  });
});
