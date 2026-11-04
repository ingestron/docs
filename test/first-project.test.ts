// The first project, run as the page shows it: every command is read from the
// page and run in order, and every output block is compared with what the
// command prints, so the page and the product cannot drift apart.
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@ingestron/cli";
import { afterAll, describe, expect, it } from "vitest";
import { contentFile, contentFolder } from "../lib/content-files.js";

const read = (path: string) => readFileSync(join(contentFolder, contentFile(path)), "utf8");
const page = read("start/first-project.mdx");
/** The one setup line: Ingestron installed globally from npm, so every command is `ingestron …`. */
const install = "npm install -g ingestron";

/**
 * The text under a heading, written as in the page (such as `## 2. Plan`), up to
 * the next heading at its level or above. A `#` line inside a code block, such
 * as a shell comment, is not a heading.
 */
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

/** The fenced code blocks in some text, in order, by their language. */
function fences(text: string, lang: string): string[] {
  return [...text.matchAll(/^```(\S*)[^\n]*\n([\s\S]*?)^```$/gm)]
    .filter((match) => match[1] === lang)
    .map((match) => match[2]!);
}

/** The one block of a language in some text. */
function fence(text: string, lang: string): string {
  const found = fences(text, lang);
  expect(found, `one ${lang} block`).toHaveLength(1);
  return found[0]!;
}

/** Prose with its line breaks as spaces, to find a sentence wherever the page wraps it. */
const prose = (text: string) => text.replace(/\s+/g, " ");

/** Trailing spaces are not part of what a reader compares. */
const trimmed = (text: string) => text.replace(/[ \t]+$/gm, "");

/** The words of a shell line, with double-quoted words kept whole. */
const words = (line: string) =>
  [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2]!);

const duckdbVersion = spawnSync("duckdb", ["--version"], { encoding: "utf8" });
const duckdb = duckdbVersion.status === 0;
const withDuckdb = duckdb ? "" : " (skipped: the duckdb command line is not on the PATH)";
/** The DuckDB version the DuckDB pack is tested with, which the page names. */
const tested = (
  JSON.parse(
    readFileSync(join(process.cwd(), "node_modules/@ingestron/pack-duckdb/package.json"), "utf8"),
  ) as { devDependencies: Record<string, string> }
).devDependencies["@duckdb/node-api"]!.replace(/-r\.\d+$/, "");

// CI installs DuckDB, so there the DuckDB steps never skip, and run the version the page names.
it.runIf(process.env.CI)("has the DuckDB command line the page names, in CI", () => {
  expect(duckdbVersion.stdout).toMatch(new RegExp(`^v${tested.replaceAll(".", "\\.")} `));
});

/** Runs the page's commands in one project, one line at a time. */
class Shell {
  /** The temporary folder the page's commands start in. */
  readonly root = mkdtempSync(join(tmpdir(), "docs-first-project-"));
  cwd = this.root;

  /** Runs each line, stopping at the first that fails; returns the last one's exit code and output. */
  run(block: string): { code: number; output: string } {
    let last = { code: 0, output: "" };
    for (const line of block.trimEnd().split("\n")) {
      last = this.line(line);
      if (last.code !== 0) break;
    }
    return last;
  }

  private line(line: string): { code: number; output: string } {
    const [command, ...args] = words(line);
    if (command === "cd") {
      expect(args).toHaveLength(1);
      this.cwd = join(this.cwd, args[0]!);
      return { code: 0, output: "" };
    }
    if (command === "rm") {
      expect(args).toHaveLength(1);
      rmSync(join(this.cwd, args[0]!));
      return { code: 0, output: "" };
    }
    if (command === "ingestron") {
      let output = "";
      const code = run(args, { cwd: this.cwd, write: (text) => (output += text) });
      return { code, output };
    }
    if (command === "ls") {
      expect(args).toHaveLength(1);
      const names = readdirSync(join(this.cwd, args[0]!)).filter((name) => !name.startsWith("."));
      return { code: 0, output: `${names.sort().join("  ")}\n` };
    }
    if (command === "duckdb") {
      // The box a terminal shows, header, types and rows, whatever mode DuckDB
      // would pick for a pipe. Notices on stderr are not part of the output.
      const result = spawnSync("duckdb", ["-cmd", ".mode duckbox", ...args], {
        cwd: this.cwd,
        encoding: "utf8",
      });
      return {
        code: result.status ?? 1,
        output: result.status === 0 ? result.stdout : result.stdout + result.stderr,
      };
    }
    throw new Error(`The test cannot run "${line}".`);
  }

  file(path: string): string {
    return join(this.cwd, path);
  }
}

describe("Run your first project on your laptop", () => {
  const shell = new Shell();
  afterAll(() => rmSync(shell.root, { recursive: true, force: true }));
  // Read inside each test, so a missing section fails that test alone.
  const create = () => section(page, "## 1. Create the project");
  const plan = () => section(page, "## 2. Plan");
  const apply = () => section(page, "## 3. Apply");
  const build = () => section(page, "## 4. Build the tables");
  const change = () => section(page, "## Add a column");
  const conflict = () => section(page, "### Edit a generated file");
  const link = () => section(page, "### Name a connection that does not exist");

  it("installs Ingestron from npm before the first command, as setup the test does not run", () => {
    // The tests run the CLI these pages describe; the install line is the reader's setup.
    expect(fence(section(page, "## Before you start"), "sh")).toBe(`${install}\n`);
    expect(prose(section(page, "## Before you start"))).toContain("Node.js 22.13 or later");
  });

  it("creates the project with the page's commands and prints what the page quotes", () => {
    const [init, ...rest] = fence(create(), "sh").trimEnd().split("\n");
    const { code, output } = shell.run(init!);
    expect(code, output).toBe(0);
    expect(rest, "then into the project").toEqual(["cd shop"]);
    shell.run(rest.join("\n"));
    const quoted = /prints `([^`]+)`/.exec(prose(create()))?.[1];
    expect(quoted).toBeDefined();
    expect(output.split("\n")[0]).toBe(quoted);
    expect(existsSync(shell.file("project.yaml"))).toBe(true);
  });

  it("plans exactly the files the page lists", () => {
    const { code, output } = shell.run(fence(plan(), "sh"));
    expect(code, output).toBe(0);
    expect(trimmed(output)).toBe(trimmed(fence(plan(), "text")));
  });

  it("applies with the output the page shows", () => {
    const { code, output } = shell.run(fence(apply(), "sh"));
    expect(code, output).toBe(0);
    expect(trimmed(output)).toBe(trimmed(fence(apply(), "text")));
    expect(existsSync(shell.file("build/dev/run.sql"))).toBe(true);
  });

  it(`builds the tables and shows the box the page shows${withDuckdb}`, ({ skip }) => {
    if (!duckdb) skip();
    const [commands, list] = fences(build(), "sh");
    const [box, listed] = fences(build(), "text");
    const { code, output } = shell.run(commands!);
    expect(code, output).toBe(0);
    // Exact, so the header, the type row (varchar, int64, double) and every row match.
    expect(box!.split("\n")[2], "the box's type row").toMatch(/^│ varchar +│ int64 +│ double +│$/);
    expect(output).toBe(box);
    const published = shell.run(list!);
    expect(published.output.split(/\s+/).filter(Boolean)).toEqual(
      listed!.split(/\s+/).filter(Boolean),
    );
  });

  it("plans the change the page shows when a column is added", () => {
    const [contract] = fences(change(), "yaml");
    const csv = fence(change(), "csv");
    expect(contract, "the contract line to add").toBeDefined();
    appendFileSync(shell.file("contracts/orders.yaml"), contract!);
    writeFileSync(shell.file("samples/orders.csv"), csv);
    const [planned, applied] = fences(change(), "sh");
    const { code, output } = shell.run(planned!);
    expect(code, output).toBe(0);
    expect(trimmed(output)).toBe(trimmed(fences(change(), "text")[0]!));
    expect(applied, "the commands that apply and run again").toBeDefined();
  });

  it(`applies the new column and shows the box the page shows${withDuckdb}`, ({ skip }) => {
    const applied = fences(change(), "sh")[1]!;
    const lines = applied.trimEnd().split("\n");
    const ingestron = lines.filter((line) => line.startsWith("ingestron "));
    expect(ingestron, "apply comes first").toEqual([lines[0]]);
    const result = shell.run(lines[0]!);
    expect(result.code, result.output).toBe(0);
    expect(result.output.trimEnd().split("\n").at(-1)).toBe("Applied.");
    if (!duckdb) skip();
    const { code, output } = shell.run(lines.slice(1).join("\n"));
    expect(code, output).toBe(0);
    expect(output).toBe(fences(change(), "text")[1]);
  });

  it("reports a hand-edited file as a conflict, overwrites nothing, and writes it again once deleted", () => {
    const line = /[Aa]dd the line `([^`]+)` at the end of `build\/dev\/run\.sql`/.exec(
      prose(conflict()),
    )?.[1];
    expect(line, "the line the page adds").toBeDefined();
    appendFileSync(shell.file("build/dev/run.sql"), `${line}\n`);
    const [planned, undo] = fences(conflict(), "sh");
    const [conflicted, rewritten] = fences(conflict(), "text");
    let result = shell.run(planned!);
    expect(result.code).toBe(1);
    expect(trimmed(result.output)).toBe(trimmed(conflicted!));
    result = shell.run("ingestron apply");
    expect(result.code).toBe(1);
    expect(readFileSync(shell.file("build/dev/run.sql"), "utf8")).toContain(line);
    result = shell.run(undo!);
    expect(result.code, result.output).toBe(0);
    expect(trimmed(result.output)).toBe(trimmed(rewritten!));
    expect(readFileSync(shell.file("build/dev/run.sql"), "utf8")).not.toContain(line);
  });

  it("reports BROKEN_LINK with its fix for the page's broken flow, and plans nothing once undone", () => {
    const edit = /change `([^`]+)` to `([^`]+)`/.exec(prose(link()));
    expect(edit, "the edit the page makes").not.toBeNull();
    const [, from, to] = edit!;
    const flow = shell.file("flows/orders.yaml");
    const original = readFileSync(flow, "utf8");
    expect(original).toContain(`${from}\n`);
    writeFileSync(flow, original.replace(`${from}\n`, `${to}\n`));
    let result = shell.run(fence(link(), "sh"));
    expect(result.code).toBe(1);
    expect(trimmed(result.output)).toBe(trimmed(fence(link(), "text")));
    writeFileSync(flow, original);
    result = shell.run(fence(link(), "sh"));
    expect(result.code).toBe(0);
    const settled = /plan reports `([^`]+)`/.exec(prose(link()))?.[1];
    expect(settled, "what plan reports once undone").toBeDefined();
    expect(result.output.trimEnd().split("\n").at(-1)).toBe(settled);
  });
});

describe("the home page's first run", () => {
  const home = read("index.mdx");
  const steps = ["## 1. Create the project", "## 2. Plan", "## 3. Apply", "## 4. Build the tables"];

  it("installs first, then uses the first project's commands, in order", () => {
    // The install, every command of steps 1 to 3, then step 4's build and query.
    const commands = steps.flatMap((heading) =>
      fences(section(page, heading), "sh")[0]!.trimEnd().split("\n"),
    );
    const run = section(home, "## Run it on your laptop");
    expect(fence(run, "sh").trimEnd().split("\n")).toEqual([install, ...commands]);
  });

  it("shows the rows the first project builds", () => {
    const run = section(home, "## Run it on your laptop");
    expect(fence(run, "text")).toBe(fences(section(page, "## 4. Build the tables"), "text")[0]);
  });

  it("names the starting point and links to the first project", () => {
    const run = section(home, "## Run it on your laptop");
    expect(run).toContain("/docs/start/first-project");
    expect(run).toContain("Node.js 22.13");
    expect(run).toContain("DuckDB command line");
  });
});
