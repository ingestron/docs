// "Work with a coding assistant", run as the page shows it: the project its
// `init` makes, the files each name writes, the start of the guide, and the
// lines `assistant add`, `plan` and `apply` print, compared with what the
// command prints and writes.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@ingestron/cli";
import { describe, expect, it } from "vitest";
import { cli, commands, fences, read, section } from "./pages.js";

const page = read("tools/assistants.mdx");
const lines = commands(page);
const text = (cwd: string, file: string) => readFileSync(join(cwd, file), "utf8");

/** The arguments of a command the page shows, which must be there exactly as written. */
function shown(line: string): string[] {
  expect(lines, line).toContain(line);
  return line.split(" ").slice(1);
}

/** The DuckDB starter, made in a new folder by `init` with these arguments. */
function starter(args: string[]): { parent: string; output: string } {
  const parent = mkdtempSync(join(tmpdir(), "docs-assistants-"));
  const made = cli(parent, args);
  expect(made.code, made.output).toBe(0);
  return { parent, output: made.output };
}

/** The files the page shows Ingestron writing, by the titles of its blocks. */
const titles = [...page.matchAll(/^```markdown kind="writes" title="([^"]+)"$/gm)].map(
  (match) => match[1]!,
);
/** The small files that point an assistant at the guide: every file shown but the guide. */
const pointers = titles.filter((file) => file !== "AGENTS.md");
expect(pointers).toHaveLength(2);

/** The `markdown` block whose title is `file`, as the page shows it. */
function written(file: string): string {
  const found = [...page.matchAll(/^```markdown kind="writes" title="([^"]+)"\n([\s\S]*?)^```$/gm)]
    .filter((match) => match[1] === file)
    .map((match) => match[2]!);
  expect(found, file).toHaveLength(1);
  return found[0]!;
}

describe("tools/assistants", () => {
  it("writes the files the page shows when init names the assistants", () => {
    const init = lines.find((line) => line.startsWith("ingestron init "))!;
    const { parent, output } = starter(shown(init));
    const add = section(page, "## Add the guide");
    expect(output).toContain(fences(add, "text")[0]!);
    const cwd = join(parent, "shop");
    for (const file of pointers) expect(text(cwd, file)).toBe(written(file));
    expect(text(cwd, "AGENTS.md").startsWith(written("AGENTS.md"))).toBe(true);
    // Each name in the table writes the files its row lists.
    const rows = section(page, "## The files for each assistant")
      .split("\n")
      .filter((line) => /^\| `[a-z]+` /.test(line))
      .map((line) => line.split("|").map((cell) => cell.trim()));
    // The names the command takes, in its order, as its own mistake message lists them.
    const mistake = cli(cwd, ["assistant", "add", "none"]).output.split("\n")[0]!;
    const names = /one or more of (.*)\.$/
      .exec(mistake)![1]!
      .split(/, | or /)
      .map((name) => `\`${name}\``);
    expect(rows.map((row) => row[1])).toEqual(names);
    for (const row of rows) {
      const name = row[1]!.replace(/`/g, "");
      const { parent: folder } = starter([
        "init",
        "p",
        "--template",
        "duckdb",
        "--assistant",
        name,
        "--yes",
      ]);
      const files = row[3]!.split(", ").map((file) => file.replace(/`/g, ""));
      for (const file of ["AGENTS.md", ...pointers]) {
        let there = true;
        try {
          text(join(folder, "p"), file);
        } catch {
          there = false;
        }
        expect(there, `${name}: ${file}`).toBe(files.includes(file));
      }
    }
  });

  it("asks the question the page shows, and adds the guide to a project", () => {
    const add = section(page, "## Add the guide");
    const [, question, added] = fences(add, "text");
    // init asks it in a terminal: the last question, after the project is chosen.
    const asked: string[] = [];
    const parent = mkdtempSync(join(tmpdir(), "docs-assistants-"));
    const io = { cwd: parent, write: () => undefined, ask: (q: string) => (asked.push(q), "") };
    expect(run(["init", "asked", "--template", "duckdb"], io)).toBe(0);
    expect(asked.at(-1)!.trim()).toBe(question!.trim());
    const cwd = join(starter(["init", "shop", "--template", "duckdb", "--yes"]).parent, "shop");
    const first = cli(cwd, shown("ingestron assistant add agents"));
    expect(first.code).toBe(0);
    expect(first.output).toBe(added);
    expect(cli(cwd, ["assistant", "add", "agents"]).output).toBe("AGENTS.md: up to date\n");
  });

  it("prints the lines the page shows as plan and apply keep the section current", () => {
    const keep = section(page, "## Keep it current");
    const [wouldChange, updated, edited] = fences(keep, "text").map((block) => block.trim());
    const { parent } = starter(["init", "shop", "--template", "duckdb", "--yes"]);
    const cwd = join(parent, "shop");
    cli(cwd, ["assistant", "add", "agents"]);
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
    // An environment added to project.yaml changes the facts.
    writeFileSync(
      join(cwd, "project.yaml"),
      text(cwd, "project.yaml").replace("  dev: {}\n", "  dev: {}\n  prod: {}\n"),
    );
    const plan = cli(cwd, ["plan", "--no-diff"]);
    expect(plan.output.trimEnd().split("\n").at(-1)).toBe(wouldChange);
    const apply = cli(cwd, ["apply", "--no-diff"]);
    expect(apply.code).toBe(0);
    expect(apply.output.trimEnd().split("\n").at(-1)).toBe(updated);
    expect(text(cwd, "AGENTS.md")).toContain("Environments: `dev`, `prod`");
    // A section edited by hand is left, and said so; check never looks at it.
    writeFileSync(
      join(cwd, "AGENTS.md"),
      text(cwd, "AGENTS.md").replace("3. Work inside the standard.", "3. Always work inside it."),
    );
    const before = text(cwd, "AGENTS.md");
    const again = cli(cwd, ["apply", "--no-diff"]);
    expect(again.code).toBe(0);
    expect(again.output.trimEnd().split("\n").at(-1)).toBe(edited);
    expect(text(cwd, "AGENTS.md")).toBe(before);
    expect(cli(cwd, ["check"]).code).toBe(0);
  });
});
