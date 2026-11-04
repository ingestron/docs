// The Databricks and ADF platform pages, run as they show them: each output
// block is compared with what the command prints for the project the page
// uses, so the pages and the product cannot drift apart.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@ingestron/cli";
import { describe, expect, it } from "vitest";
import { exampleFolder } from "../lib/examples.js";

const read = (path: string) => readFileSync(join(process.cwd(), "content/docs", path), "utf8");

/** The text under a heading, such as `## Generate and inspect`, up to the next heading at its level or above. */
function section(text: string, heading: string): string {
  const level = /^#+/.exec(heading)![0].length;
  const lines = text.split("\n");
  let fenced = false;
  const headings = lines.map((line) => {
    if (line.startsWith("```")) fenced = !fenced;
    return !fenced && /^#+ /.test(line) ? /^#+/.exec(line)![0].length : 0;
  });
  const start = lines.findIndex((line, index) => line === heading && headings[index] === level);
  if (start === -1) throw new Error(`The page has no heading "${heading}".`);
  const end = headings.findIndex((found, index) => index > start && found > 0 && found <= level);
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
}

/** The `text` blocks in some text, in order. */
const outputs = (text: string) =>
  [...text.matchAll(/^```text\n([\s\S]*?)^```$/gm)].map((match) => match[1]!);

/** Runs the CLI in a folder and returns its exit code and what it printed. */
function cli(cwd: string, args: string[]): { code: number; output: string } {
  let output = "";
  const code = run(args, { cwd, write: (text) => (output += text) });
  return { code, output };
}

describe("platforms/databricks", () => {
  const page = read("platforms/databricks.mdx");

  it("prints the retail project's plan and its deliberate break as the page shows", () => {
    const parent = mkdtempSync(join(tmpdir(), "docs-databricks-retail-"));
    expect(cli(parent, ["init", "retail", "--template", "retail", "--yes"]).code).toBe(0);
    const cwd = join(parent, "retail");

    const [plan] = outputs(section(page, "### 5. Generate"));
    const planned = cli(cwd, ["plan", "--env", "dev", "--no-diff"]);
    expect(planned.code).toBe(0);
    expect(planned.output.trim()).toBe(plan!.trim());

    const transform = join(cwd, "transforms/daily_sales.yaml");
    const original = readFileSync(transform, "utf8");
    writeFileSync(transform, original.replace(/^id: daily_sales$/m, "id: orders"));
    const [problem] = outputs(section(page, "### 6. Break it on purpose"));
    const broken = cli(cwd, ["plan", "--env", "dev", "--no-diff"]);
    expect(broken.code).toBe(1);
    expect(broken.output.trim()).toBe(problem!.trim());
  });
});

describe("platforms/adf", () => {
  const page = read("platforms/adf.mdx");
  const project = () => {
    const cwd = mkdtempSync(join(tmpdir(), "docs-adf-page-"));
    cpSync(exampleFolder("connection-first-adf"), cwd, { recursive: true });
    return cwd;
  };

  it("lists the ADF prerequisites the platform request prints", () => {
    const [prerequisites] = outputs(section(page, "## Platform prerequisites"));
    const request = cli(project(), ["request", "--env", "dev"]);
    expect(request.code).toBe(0);
    expect(request.output.trimEnd().endsWith(prerequisites!.trim())).toBe(true);
  });

  it("prints the factory's files, and the missing-server problem, as the page shows", () => {
    const cwd = project();
    const [plan, problem] = outputs(section(page, "## Generate and inspect"));
    const planned = cli(cwd, ["plan", "--env", "dev", "--no-diff"]);
    expect(planned.code).toBe(0);
    expect(planned.output).toContain(plan!.trim());

    const connection = join(cwd, "connections/postgresql.yaml");
    writeFileSync(connection, readFileSync(connection, "utf8").replace(/^ {2}server: .*\n/m, ""));
    const broken = cli(cwd, ["plan", "--env", "dev", "--no-diff"]);
    expect(broken.code).toBe(1);
    expect(broken.output.trim()).toBe(problem!.trim());
  });
});
