// "Not applied here": what it shows is what the CLI prints for the first
// project, and the layers it gives take the warning away.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, copy, fences, read, section } from "./pages.js";

const page = read("concepts/not-applied.mdx");

describe("concepts/not-applied", () => {
  it("shows the warning the first project's plan prints", () => {
    const shown = fences(section(page, "## Where it shows [#where-it-shows]"), "text")[0]!;
    const plan = cli(copy("duckdb"), ["plan", "--no-diff"]);
    expect(plan.code).toBe(0);
    expect(plan.output.startsWith(shown)).toBe(true);
  });

  it("takes the warning away with the layers it gives, and then counts the rule", () => {
    const layers = fences(section(page, "## A layer that does not check [#layers]"), "yaml")[0]!;
    const cwd = copy("duckdb");
    const standard = join(cwd, "standard.yaml");
    writeFileSync(standard, readFileSync(standard, "utf8") + layers);
    const plan = cli(cwd, ["apply", "--no-diff"]);
    expect(plan.code).toBe(0);
    expect(plan.output).not.toContain("warning");
    expect(readFileSync(join(cwd, "build/duckdb/dev/run.sql"), "utf8")).toContain(
      "('bronze.orders', 'order_id_not_null', 'warn',",
    );
  });
});
