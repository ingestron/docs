// The Databricks and ADF platform pages, run as they show them: each command
// is read from the page and run, and each output block is compared with what
// the command prints, so the pages and the product cannot drift apart. The
// pages' hand-written YAML fragments, which no sample holds, are applied to a
// sample and generated, so they stay valid.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@ingestron/cli";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
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

/** The fenced blocks of one language in some text, in order. */
const fences = (text: string, lang: string) =>
  [...text.matchAll(/^```(\S*)[^\n]*\n([\s\S]*?)^```$/gm)]
    .filter((match) => match[1] === lang)
    .map((match) => match[2]!);

/** The command lines of the `sh` blocks in some text. */
const commands = (text: string) =>
  fences(text, "sh").flatMap((block) => block.trimEnd().split("\n"));

/** The one `ingestron` command, among some lines, that starts with a prefix. */
function command(lines: string[], prefix: string): string[] {
  const found = lines.filter((line) => line.startsWith(`ingestron ${prefix}`));
  expect(found, `one "ingestron ${prefix}" command`).toHaveLength(1);
  return found[0]!.split(" ").slice(1);
}

/** Runs the CLI in a folder and returns its exit code and what it printed. */
function cli(cwd: string, args: string[]): { code: number; output: string } {
  let output = "";
  const code = run(args, { cwd, write: (text) => (output += text) });
  return { code, output };
}

/** A copy of a sample, to change and generate. */
function copy(name: string): string {
  const cwd = mkdtempSync(join(tmpdir(), `docs-platform-${name}-`));
  cpSync(exampleFolder(name), cwd, { recursive: true });
  return cwd;
}

/** Merges a YAML fragment into a definition file, the way a reader adds it. */
function merge(file: string, fragment: string): void {
  const into = (target: Record<string, unknown>, source: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(source)) {
      const existing = target[key];
      if (value && typeof value === "object" && !Array.isArray(value) && existing)
        into(existing as Record<string, unknown>, value as Record<string, unknown>);
      else target[key] = value;
    }
  };
  const document = parse(readFileSync(file, "utf8"));
  into(document, parse(fragment));
  writeFileSync(file, stringify(document));
}

describe("platforms/databricks", () => {
  const page = read("platforms/databricks.mdx");

  it("prints the retail project's plan and its deliberate break as the page shows", () => {
    const example = section(page, "## Work through the retail project");
    const create = commands(example);
    expect(create[1], "the page changes into the project").toMatch(/^cd /);
    const parent = mkdtempSync(join(tmpdir(), "docs-databricks-retail-"));
    expect(cli(parent, command(create, "init")).code).toBe(0);
    const cwd = join(parent, create[1]!.slice("cd ".length));

    const generate = section(page, "### 5. Generate");
    const plan = command(commands(generate), "plan");
    const planned = cli(cwd, plan);
    expect(planned.code).toBe(0);
    expect(planned.output.trim()).toBe(fences(generate, "text")[0]!.trim());

    // "plan again": the same command, after the change the page names.
    const transform = join(cwd, "transforms/daily_sales.yaml");
    const original = readFileSync(transform, "utf8");
    writeFileSync(transform, original.replace(/^id: daily_sales$/m, "id: orders"));
    const broken = cli(cwd, plan);
    expect(broken.code).toBe(1);
    expect(broken.output.trim()).toBe(
      fences(section(page, "### 6. Break it on purpose"), "text")[0]!.trim(),
    );
  });
});

describe("platforms/adf", () => {
  const page = read("platforms/adf.mdx");

  it("lists the ADF prerequisites the platform request prints", () => {
    const prerequisites = section(page, "## Platform prerequisites");
    const written = /`(ingestron request [^`]+)`/.exec(prerequisites);
    expect(written, "the request command, in the prose").not.toBeNull();
    const request = cli(copy("connection-first-adf"), written![1]!.split(" ").slice(1));
    expect(request.code).toBe(0);
    expect(request.output.trimEnd().endsWith(fences(prerequisites, "text")[0]!.trim())).toBe(true);
  });

  it("prints the factory's files after the Databricks ones, and the missing-server problem", () => {
    const cwd = copy("connection-first-adf");
    const generate = section(page, "## Generate and inspect");
    const plan = command(commands(generate), "plan");
    const [files, problem] = fences(generate, "text");
    const planned = cli(cwd, plan);
    expect(planned.code).toBe(0);
    const databricks = planned.output.indexOf("dev/databricks → build/dev/databricks");
    const adf = planned.output.indexOf(files!.trim());
    expect(databricks, "the Databricks files").toBeGreaterThan(-1);
    expect(adf, "the page's ADF files").toBeGreaterThan(databricks);

    // "plan again", without the field the page removes.
    const connection = join(cwd, "connections/postgresql.yaml");
    writeFileSync(connection, readFileSync(connection, "utf8").replace(/^ {2}server: .*\n/m, ""));
    const broken = cli(cwd, plan);
    expect(broken.code).toBe(1);
    expect(broken.output.trim()).toBe(problem!.trim());
  });

  it("stops only the copies with the pause fragment, in the finished project's method", () => {
    const [fragment] = fences(section(page, "### Retry and pause"), "yaml");
    const cwd = copy("connection-first-adf");
    const method = Object.keys(parse(readFileSync(join(cwd, "platform.yaml"), "utf8")).settings);
    expect(Object.keys(parse(fragment!).settings)).toEqual(method);
    merge(join(cwd, "platform.yaml"), fragment!);
    const out = join(cwd, "out");
    expect(cli(cwd, ["apply", "--env", "prod", "--no-diff", "--out", out]).code).toBe(0);
    const trigger = JSON.parse(
      readFileSync(join(out, "prod/adf/trigger/tr_sales_orders_prod.json"), "utf8"),
    );
    // Production triggers start by default; the fragment stops this one.
    expect(trigger.properties.runtimeState).toBe("Stopped");
  });
});

describe("platforms/adf-pipelines", () => {
  it("generates the pipeline design the page's standard fragment sets", () => {
    const [fragment] = fences(read("platforms/adf-pipelines.mdx"), "yaml");
    const cwd = copy("private-sql-server");
    merge(join(cwd, "standard.yaml"), fragment!);
    const out = join(cwd, "out");
    const applied = cli(cwd, ["apply", "--env", "dev", "--no-diff", "--out", out]);
    expect(applied.code, applied.output).toBe(0);
    const pipeline = JSON.parse(
      readFileSync(join(out, "dev/adf/pipeline", pipelineFile(applied.output)), "utf8"),
    );
    const text = JSON.stringify(pipeline);
    expect(text).toContain('"for_each_table"');
    expect(text).toContain('"copy_table"');
    expect(text).toContain('"_loaded_at"');
    const project = parse(readFileSync(join(cwd, "project.yaml"), "utf8")).id;
    expect(pipeline.properties.folder.name).toBe(`ingestron/${project}`);
    expect(pipeline.properties.annotations).toContain("finance");
  });
});

/** The one pipeline file a plan or apply lists. */
function pipelineFile(output: string): string {
  const found = [...output.matchAll(/create {4}pipeline\/(\S+\.json)/g)].map((match) => match[1]!);
  expect(found, "one generated pipeline").toHaveLength(1);
  return found[0]!;
}
