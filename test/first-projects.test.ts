// The first project on Synapse, Databricks and Azure Data Factory, run as each
// platform's page shows it: every `ingestron` command in order, in a new
// folder, with each file the page has you write; then what it prints, and the
// generated files it shows, compared with what the commands wrote. No cloud:
// the CLI never connects to a source or to Azure.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentFolder } from "../lib/content-files.js";
import { pageText } from "../lib/platform-text.js";
import { cli } from "./pages.js";

/** Each fenced block of a page, in order: its language, its fence line and its text. */
const blocks = (text: string) =>
  [...text.matchAll(/^```(\S*)([^\n]*)\n([\s\S]*?)^```$/gm)].map(([, lang, meta, body]) => ({
    lang: lang!,
    title: /title="([^"]+)"/.exec(meta!)?.[1],
    plain: /kind="plain"/.test(meta!),
    body: body!.replace(/\n$/, ""),
  }));

/** Its non-empty lines, trimmed at the end: blank lines in output are not compared. */
const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

/** Whether each of `shown` appears in `output`, in order. */
function inOrder(shown: string[], output: string[]): string | undefined {
  let at = 0;
  for (const line of shown) {
    const found = output.indexOf(line, at);
    if (found === -1) return line;
    at = found + 1;
  }
  return undefined;
}

/** Runs a page's blocks in a folder, as the reader would; returns the folder it ends in. */
function runPage(page: string, start: string, platform: string): string {
  let cwd = start;
  let last = "";
  for (const block of blocks(page)) {
    if (block.lang === "sh") {
      for (const line of block.body.split("\n")) {
        if (line.startsWith("cd ")) cwd = join(cwd, line.slice(3));
        if (!line.startsWith("ingestron ")) continue;
        const { code, output } = cli(cwd, line.split(" ").slice(1));
        expect(code, `${platform}: ${line}\n${output}`).toBe(0);
        last = output;
      }
    } else if (block.title && !block.plain && block.lang !== "sql" && block.lang !== "json") {
      mkdirSync(dirname(join(cwd, block.title)), { recursive: true });
      writeFileSync(join(cwd, block.title), `${block.body}\n`);
    } else if (block.title && block.plain) {
      expect(readFileSync(join(cwd, block.title), "utf8").trim(), block.title).toBe(
        block.body.trim(),
      );
    } else if (block.title) {
      const written = readFileSync(join(cwd, block.title), "utf8");
      expect(written.startsWith(block.body), `${platform}: ${block.title}`).toBe(true);
    } else if (block.lang === "text") {
      const missing = inOrder(lines(block.body), lines(last));
      expect(missing, `${platform}: printed\n${last}`).toBeUndefined();
    }
  }
  return cwd;
}

describe.each(["synapse", "databricks", "adf", "adf-databricks", "adf-synapse", "adf-duckdb"])(
  "the first project on %s",
  (platform) => {
    const page = pageText(join(contentFolder, platform, "(start)/first-project.mdx"));

    it("runs as the page shows it, and prints and writes what it shows", () => {
      let cwd = mkdtempSync(join(tmpdir(), `docs-first-${platform}-`));
      let last = "";
      let ran = 0;
      for (const block of blocks(page)) {
        if (block.lang === "sh") {
          for (const line of block.body.split("\n")) {
            if (line.startsWith("cd ")) cwd = join(cwd, line.slice(3));
            if (!line.startsWith("ingestron ")) continue;
            const { code, output } = cli(cwd, line.split(" ").slice(1));
            expect(code, `${platform}: ${line}\n${output}`).toBe(0);
            last = output;
            ran++;
          }
        } else if (block.title && !block.plain && block.lang !== "sql" && block.lang !== "json") {
          // A file the reader writes.
          mkdirSync(dirname(join(cwd, block.title)), { recursive: true });
          writeFileSync(join(cwd, block.title), `${block.body}\n`);
        } else if (block.title && block.plain) {
          // A file the project holds, shown as it is.
          expect(readFileSync(join(cwd, block.title), "utf8").trim(), block.title).toBe(
            block.body.trim(),
          );
        } else if (block.title) {
          // A generated file, shown whole or from its start.
          const written = readFileSync(join(cwd, block.title), "utf8");
          expect(written.startsWith(block.body), `${platform}: ${block.title}`).toBe(true);
        } else if (block.lang === "text") {
          // What the last command printed.
          const missing = inOrder(lines(block.body), lines(last));
          expect(missing, `${platform}: printed\n${last}`).toBeUndefined();
        }
      }
      expect(ran).toBeGreaterThanOrEqual(2);
      // The project is up to date once applied.
      expect(cli(cwd, ["check"]).output).toContain("up to date");
    }, 60_000);

    it("names no other platform", () => {
      for (const other of ["Databricks", "DuckDB", "Synapse"].filter(
        (name) =>
          !platform.split("-").some((part) => name.toLowerCase().startsWith(part.slice(0, 3))),
      ))
        expect(page, `${platform} names ${other}`).not.toContain(other);
    });
  },
);

describe.each(["synapse", "databricks", "adf"])("adding a table on %s", (platform) => {
  it("adds customers to the first project's flow with the steps and plan the page shows", () => {
    const first = pageText(join(contentFolder, platform, "(start)/first-project.mdx"));
    const cwd = runPage(first, mkdtempSync(join(tmpdir(), `docs-add-${platform}-`)), platform);
    const page = pageText(join(contentFolder, platform, "(guides)/add-a-source.mdx"));
    const steps = page.slice(
      page.indexOf("## Add a table from a source you already read"),
      page.indexOf("## Add another source"),
    );
    // The page's steps in order: the sample, the contract, the flow's new table, the plan.
    let last = "";
    for (const block of blocks(steps.replace(/^ {3}/gm, ""))) {
      if (block.lang === "csv") {
        mkdirSync(join(cwd, "samples"), { recursive: true });
        writeFileSync(join(cwd, "samples/customers.csv"), `${block.body}\n`);
      } else if (block.lang === "yaml")
        writeFileSync(
          join(cwd, "flows/orders.yaml"),
          `${readFileSync(join(cwd, "flows/orders.yaml"), "utf8")}${block.body}\n`,
        );
      else if (block.lang === "sh") {
        const { code, output } = cli(cwd, block.body.split(" ").slice(1));
        expect(code, `${platform}: ${block.body}\n${output}`).toBe(0);
        last = output;
      } else if (block.lang === "text")
        expect(inOrder(lines(block.body), lines(last)), `${platform}\n${last}`).toBeUndefined();
    }
  }, 60_000);
});

describe("not applied on Azure Data Factory", () => {
  it("reports cleansing a landed table as its concept page shows", () => {
    const first = pageText(join(contentFolder, "adf", "(start)/first-project.mdx"));
    const cwd = runPage(first, mkdtempSync(join(tmpdir(), "docs-notapplied-adf-")), "adf");
    const flow = join(cwd, "flows/orders.yaml");
    writeFileSync(
      flow,
      readFileSync(flow, "utf8").replace(
        "    contract: orders\n",
        "    contract: orders\n    cleanse:\n      columns:\n        customer: { case: lower }\n",
      ),
    );
    const page = pageText(join(contentFolder, "adf", "(concepts)/not-applied.mdx"));
    const shown = blocks(page).find((block) => block.lang === "text")!;
    const { output } = cli(cwd, ["plan", "--no-diff"]);
    expect(inOrder(lines(shown.body), lines(output)), output).toBeUndefined();
  }, 60_000);
});

describe("cleansing on Synapse", () => {
  it("cleanses a column of the first project's orders view as its page shows it", () => {
    const first = pageText(join(contentFolder, "synapse", "(start)/first-project.mdx"));
    const cwd = runPage(first, mkdtempSync(join(tmpdir(), "docs-cleanse-synapse-")), "synapse");
    const page = pageText(join(contentFolder, "synapse", "(guides)/cleanse-data.mdx"));
    const shown = blocks(page);
    // The layers the page adds at the end of the standard.
    const layers = shown.find(
      (block) => block.lang === "yaml" && block.body.startsWith("layers:"),
    )!;
    writeFileSync(
      join(cwd, "standard.yaml"),
      `${readFileSync(join(cwd, "standard.yaml"), "utf8").trimEnd()}\n${layers.body}\n`,
    );
    // The flow as the page writes it, then plan and apply.
    const flow = shown.find((block) => block.title === "flows/orders.yaml")!;
    writeFileSync(join(cwd, "flows/orders.yaml"), `${flow.body}\n`);
    expect(cli(cwd, ["plan", "--no-diff"]).code).toBe(0);
    expect(cli(cwd, ["apply"]).code).toBe(0);
    const line = shown.find((block) => block.lang === "sql" && block.plain)!;
    const views = readFileSync(join(cwd, "build/synapse/views.sql"), "utf8");
    expect(views).toContain(line.body.trim());
    expect(views).toContain("CREATE OR ALTER VIEW [silver].[orders]");
    // Without `layer: silver`, the plan refuses as the page shows.
    writeFileSync(join(cwd, "flows/orders.yaml"), `${flow.body.replace("layer: silver\n", "")}\n`);
    const refused = cli(cwd, ["plan", "--no-diff"]);
    expect(refused.code).toBe(1);
    const problem = shown.find(
      (block) => block.lang === "text" && block.body.includes("LAYER_RESPONSIBILITY"),
    )!;
    expect(inOrder(lines(problem.body), lines(refused.output))).toBeUndefined();
  }, 60_000);
});
