// "Cleanse data in the right layer", run as the page shows it: the project is
// created from the published standard with the page's command, each file the
// page writes is written from its block, each command is run, and each output
// block is compared with what the command prints.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, commands, fences, read, section } from "./pages.js";

const page = read("how-to/cleanse-data.mdx");
const prose = (text: string) => text.replace(/\s+/g, " ");
const duckdb = spawnSync("duckdb", ["--version"], { encoding: "utf8" }).status === 0;
const withDuckdb = duckdb ? "" : " (skipped: the duckdb command line is not on the PATH)";

/** The words of a shell line, with double-quoted words kept whole. */
const words = (line: string) =>
  [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2]!);

/** The project the page creates, in a new folder, with the page's own commands. */
function created(): string {
  const [init, cd] = commands(section(page, "## Create the project"));
  expect(init).toMatch(/^ingestron init shop --kit duckdb\/local-medallion@/);
  const parent = mkdtempSync(join(tmpdir(), "docs-cleanse-"));
  expect(cli(parent, words(init!).slice(1)).code).toBe(0);
  expect(cd).toBe("cd shop");
  return join(parent, "shop");
}

/** Replaces text the file must hold. */
function change(file: string, from: string, to: string): void {
  const text = readFileSync(file, "utf8");
  expect(text, `${file} holds ${from}`).toContain(from);
  writeFileSync(file, text.replace(from, to));
}

/** The project after the page's changes: the columns, the zone and the transform. */
function changed(): string {
  const cwd = created();
  const steps = section(page, "## Add the columns to cleanse");
  writeFileSync(join(cwd, "samples/orders.csv"), fences(steps, "csv")[0]!);
  const [columns, zone] = fences(steps, "yaml");
  change(
    join(cwd, "contracts/orders.yaml"),
    "      - { name: ordered_at, logicalType: date }\n",
    columns!,
  );
  expect(prose(steps)).toContain("Add this line to `connections/shop.yaml`, under `connectivity`");
  change(
    join(cwd, "connections/shop.yaml"),
    "connectivity: public\n",
    `connectivity: public\n${zone}`,
  );
  const transform = section(page, "## Add a silver table without code");
  expect(prose(transform)).toContain("Save this as `transforms/orders_clean.yaml`");
  writeFileSync(join(cwd, "transforms/orders_clean.yaml"), fences(transform, "yaml")[0]!);
  return cwd;
}

describe("how-to/cleanse-data", () => {
  it("creates the project from the published standard with no warning", () => {
    const cwd = created();
    const plan = cli(cwd, ["plan", "--no-diff"]);
    expect(plan.code).toBe(0);
    expect(plan.output).not.toContain("warning");
  });

  it("plans the cleansed silver table the page shows, with no warning", () => {
    const cwd = changed();
    const steps = section(page, "## Plan, apply and run");
    const plan = cli(cwd, words(commands(steps)[0]!).slice(1));
    expect(plan.code).toBe(0);
    expect(plan.output.trim()).toBe(fences(steps, "text")[0]!.trim());
  });

  it(`builds the tables and shows the rows the page shows${withDuckdb}`, ({ skip }) => {
    if (!duckdb) skip();
    const cwd = changed();
    const steps = section(page, "## Plan, apply and run");
    const lines = commands(steps).slice(1);
    let shown = "";
    for (const line of lines) {
      const [command, ...args] = words(line);
      if (command === "ingestron") {
        expect(cli(cwd, args).code).toBe(0);
        continue;
      }
      expect(command).toBe("duckdb");
      const result = spawnSync("duckdb", ["-cmd", ".mode duckbox", ...args], {
        cwd,
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      // The build's own output, its checks, is described, not shown.
      if (!args.includes("-bail")) shown += result.stdout;
    }
    expect(shown).toBe(fences(steps, "text")[1]);
  });

  it("refuses cleansing in bronze with the page's error, and plans again once put back", () => {
    const cwd = changed();
    const steps = section(page, "## Ask a layer for a duty it does not do");
    const [asked, original] = fences(steps, "yaml");
    const flow = join(cwd, "flows/orders.yaml");
    // What the page puts back is what the published standard wrote.
    expect(readFileSync(flow, "utf8")).toBe(original);
    writeFileSync(flow, asked!);
    const plan = cli(cwd, words(commands(steps)[0]!).slice(1));
    expect(plan.code).toBe(1);
    expect(plan.output.trim()).toBe(fences(steps, "text")[0]!.trim());
    writeFileSync(flow, original!);
    expect(cli(cwd, ["plan", "--no-diff"]).code).toBe(0);
  });

  it("says deduplicate is redundant in a silver table kept at history: latest", () => {
    const cwd = changed();
    const steps = section(page, "## Keep one row per key");
    const file = join(cwd, "transforms/orders_clean.yaml");
    const text = readFileSync(file, "utf8").replace(
      "cleanse:\n",
      `cleanse:\n${fences(steps, "yaml")[0]!.replace("cleanse:\n", "")}`,
    );
    writeFileSync(file, text);
    const plan = cli(cwd, ["plan", "--no-diff"]);
    expect(plan.code).toBe(0);
    expect(plan.output).toContain("warning  DEDUPLICATE_MODE");
    expect(plan.output).toContain('Deduplicate is redundant for "orders_clean"');
  });
});
