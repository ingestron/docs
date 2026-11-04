// The "Standards and teams" guides, run as they show them: each command is
// read from the page and run in a copy of the project the page names, each
// output block is compared with what the command prints, and each hand-written
// YAML fragment is merged into a sample and planned.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PackNaming } from "../components/reference/pack-defaults";
import { exampleFolder } from "../lib/examples";
import { packName, packs } from "../lib/reference";
import { cli, command, commands, copy, fences, merge, read, section } from "./pages.js";

/** The `sh` lines of some text, with each `\` continuation joined to its line. */
const joined = (text: string) =>
  fences(text, "sh").flatMap((block) =>
    block
      .trimEnd()
      .replace(/ \\\n\s*/g, " ")
      .split("\n"),
  );

/** The page's request command, run in a folder: its exit code and output. */
const request = (page: string, cwd: string) =>
  cli(cwd, command(commands(section(page, "## What each route asks for")), "request"));

/** The `shop` project the request guide creates from the minimal starter, with its own commands. */
function shop(page: string): string {
  const create = commands(section(page, "### Databricks"));
  const parent = mkdtempSync(join(tmpdir(), "docs-request-shop-"));
  expect(cli(parent, command(create, "init")).code).toBe(0);
  const cd = create.find((line) => line.startsWith("cd "))!;
  return join(parent, cd.slice("cd ".length));
}

/** A Git repository holding one folder's files, as a `file://` URL. */
function repository(files: Record<string, string>): string {
  const folder = mkdtempSync(join(tmpdir(), "docs-git-"));
  for (const [path, from] of Object.entries(files))
    cpSync(from, join(folder, path), { recursive: true });
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "user.name=Docs", "-c", "user.email=docs@example.com", ...args], {
      cwd: folder,
      stdio: "pipe",
    });
  git("init", "--quiet");
  git("add", ".");
  git("commit", "--quiet", "-m", "Shared files");
  return `file://${folder}`;
}

describe("how-to/ask-the-platform-team", () => {
  const page = read("how-to/ask-the-platform-team.mdx");

  it("prints the smallest project's request, from the minimal starter, as the page shows", () => {
    const shown = fences(section(page, "### Databricks"), "text")[0]!;
    const printed = request(page, shop(page));
    expect(printed.code).toBe(0);
    expect(printed.output.trim()).toBe(shown.trim());
  });

  it("prints what the ADF, Synapse and DuckDB routes add, from each platform page's project", () => {
    for (const [heading, guide, sample, whole] of [
      ["### Azure Data Factory", "platforms/landing-only", "landing-only", true],
      ["### Synapse serverless views", "platforms/synapse", "synapse-views", false],
      ["### DuckDB in Azure", "platforms/duckdb-in-azure", "duckdb-local", false],
    ] as const) {
      const route = section(page, heading);
      // The project is the one the linked platform page works with.
      expect(route, heading).toContain(`(/docs/${guide})`);
      expect(read(`${guide}.mdx`), guide).toContain(`<ExampleDownload name="${sample}" />`);
      const printed = request(page, copy(sample));
      expect(printed.code, heading).toBe(0);
      const shown = fences(route, "text")[0]!.trim();
      if (whole) expect(printed.output.trim(), heading).toBe(shown);
      else expect(printed.output, heading).toContain(`\n${shown}\n`);
    }
  });

  it("asks for a variable that is not set yet, then says where it is set, never its value", () => {
    const values = section(page, "## Values to provide");
    const [fragment] = fences(values, "yaml");
    const cwd = shop(page);
    merge(join(cwd, "project.yaml"), fragment!);
    const unset = request(page, cwd);
    expect(unset.code, "unset variables alone do not stop the request").toBe(0);
    expect(unset.output.trim()).toBe(fences(values, "text")[0]!.trim());

    // Set on your own computer: the line names the file, and the value is shown only where it is used.
    const value = "/Volumes/dev/landing/shop";
    writeFileSync(join(cwd, ".env.dev"), `LANDING_PATH=${value}\n`);
    const set = request(page, cwd).output;
    const provide = set.split("## Values to provide")[1]!.split("\n## ")[0]!;
    expect(provide).toContain(
      "- `LANDING_PATH`, used for `values.landing` in `project.yaml`: set in `.env.dev`.",
    );
    expect(provide).not.toContain(value);
    expect(set).toContain(`Files at \`${value}\``);
    expect(values).toContain("`.env.dev`");
  });

  it("is only the title and one line when the definitions have problems, and exits with 1", () => {
    const problems = section(page, "## When the definitions have problems");
    const cwd = shop(page);
    const connection = join(cwd, "connections/shop.yaml");
    writeFileSync(
      connection,
      readFileSync(connection, "utf8").replace("connector: files", "connector: nothing"),
    );
    const broken = request(page, cwd);
    expect(broken.code).toBe(1);
    expect(broken.output.trim()).toBe(fences(problems, "text")[0]!.trim());
    expect(problems).toContain("exits with `1`");
  });
});

describe("how-to/configure-a-standard", () => {
  const page = read("how-to/configure-a-standard.mdx");

  it("starts a project with the platform team's standard from a path, saying where it came from", () => {
    const start = section(page, "## Start each project from it");
    const init = joined(start).find((line) => line.startsWith("ingestron init "))!;
    const path = /--standard (\S+)/.exec(init)![1]!;
    const parent = mkdtempSync(join(tmpdir(), "docs-standard-path-"));
    const cwd = join(parent, "projects");
    mkdirSync(cwd);
    // A standard for the route the command chooses: ADF copies, Databricks stores.
    mkdirSync(join(cwd, path, ".."), { recursive: true });
    const standard = readFileSync(
      join(exampleFolder("connection-first-adf"), "standard.yaml"),
      "utf8",
    );
    writeFileSync(join(cwd, path), standard);
    const created = cli(cwd, init.split(" ").slice(1));
    expect(created.code, created.output).toBe(0);
    const name = init.split(" ")[2]!;
    const copied = readFileSync(join(cwd, name, "standard.yaml"), "utf8");
    expect(copied).toBe(`# From ${path}\n${standard}`);
    expect(start).toContain(`\`${name}/standard.yaml\` starts with \`# From ${path}\``);
  });
});

describe("how-to/share-a-template", () => {
  const page = read("how-to/share-a-template.mdx");

  it("starts a project from a template and a standard kept in Git, each found after #", () => {
    const share = section(page, "## Share a standard [#share-a-standard]");
    const init = joined(share).find((line) => line.startsWith("ingestron init "))!;
    const [template, standard] = [...init.matchAll(/(https:\/\/\S+?)#(\S+)/g)];
    // The same repositories, served from this computer instead of GitHub.
    const templates = repository({ [template![2]!]: exampleFolder("minimal") });
    const platformRepo = repository({
      [standard![2]!]: join(exampleFolder("standards-and-conventions"), "standard.yaml"),
    });
    const local = mkdtempSync(join(tmpdir(), "docs-standard-git-"));
    const args = init
      .replace(template![1]!, templates)
      .replace(standard![1]!, platformRepo)
      .split(" ")
      .slice(1);
    const created = cli(local, [...args, "--yes"]);
    expect(created.code, created.output).toBe(0);
    const name = args[1]!;
    const copied = readFileSync(join(local, name, "standard.yaml"), "utf8");
    expect(copied.split("\n")[0]).toBe(`# From ${platformRepo}#${standard![2]!}`);
    expect(copied).toContain(
      readFileSync(join(exampleFolder("standards-and-conventions"), "standard.yaml"), "utf8"),
    );
    // The template came along: its flow, under the standard's names.
    expect(created.output).toContain(`src/${name}_dev/raw/orders.sql`);
  });
});

describe("how-to/name-things-your-way", () => {
  const page = read("how-to/name-things-your-way.mdx");

  it("renders each naming pack's default patterns, with the ADF pack left to its resource names", () => {
    const html = renderToStaticMarkup(createElement(PackNaming));
    const cells = (row: string) =>
      [...row.matchAll(/<t[hd]>(.*?)<\/t[hd]>/g)].map((match) => match[1]!.replace(/<[^>]+>/g, ""));
    const [header, ...body] = [...html.matchAll(/<tr>(.*?)<\/tr>/g)].map((match) =>
      cells(match[1]!),
    );
    const naming = packs.filter((pack) => pack.id !== "adf");
    expect(header).toEqual(["Name", ...naming.map((pack) => packName(pack.id))]);
    expect(body.map((row) => row[0])).toEqual(["catalog", "schema", "table", "pipeline", "job"]);
    for (const row of body)
      naming.forEach((pack, index) =>
        expect(row[index + 1], `${pack.id} ${row[0]}`).toBe(
          pack.defaults.naming[row[0] as keyof typeof pack.defaults.naming],
        ),
      );
    expect(page).toContain("<PackNaming />");
    expect(page).toContain("[ADF resource names](#adf-resource-names)");
  });

  it("creates the table under the full name the page gives, in the generated file it embeds", () => {
    const patterns = section(page, "## Write the patterns");
    const name = /created as\n`` (`[a-z_]+`\.`[a-z_]+`\.`[a-z_]+`) ``/.exec(patterns)![1]!;
    const file = /file="(build\/prod\/[^"]+)"/.exec(patterns)![1]!;
    const cwd = copy("standards-and-conventions");
    const out = join(cwd, "out");
    expect(cli(cwd, ["apply", "--no-diff", "--out", out]).code).toBe(0);
    expect(readFileSync(join(out, file.slice("build/".length)), "utf8")).toContain(
      `CREATE OR REFRESH STREAMING TABLE ${name}`,
    );
  });

  it("plans the rename the page's fragment makes, moving the pipeline's files", () => {
    const change = section(page, "## Check a change of names");
    const cwd = copy("standards-and-conventions");
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
    merge(join(cwd, "standard.yaml"), fences(change, "yaml")[0]!);
    const planned = cli(cwd, command(commands(change), "plan"));
    expect(planned.code).toBe(0);
    expect(planned.output.trim()).toBe(fences(change, "text")[0]!.trim());
  });
});

describe("how-to/upgrade", () => {
  const page = read("how-to/upgrade.mdx");

  it("stops the first project's plan when its standard names a major the command's pack lacks", () => {
    const pins = section(page, "## What the standard pins");
    expect(pins).toContain('<Example name="duckdb" file="standard.yaml" />');
    const create = commands(section(read("start/first-project.mdx"), "## 1. Create the project"));
    const init = create.find((line) => line.startsWith("npx ingestron@1 init "))!;
    const parent = mkdtempSync(join(tmpdir(), "docs-upgrade-shop-"));
    expect(cli(parent, init.split(" ").slice(2)).code).toBe(0);
    const cwd = join(parent, create.find((line) => line.startsWith("cd "))!.slice("cd ".length));
    const standard = join(cwd, "standard.yaml");
    const text = readFileSync(standard, "utf8");
    expect(text).toContain("packs: [duckdb@1]");
    writeFileSync(standard, text.replace("duckdb@1", "duckdb@2"));
    const planned = cli(cwd, ["plan"]);
    expect(planned.code).toBe(1);
    expect(planned.output.trim()).toBe(fences(pins, "text")[0]!.trim());
    // The command has one version of each pack, and the page names DuckDB's.
    const duckdb = packs.find((pack) => pack.id === "duckdb")!;
    expect(pins).toContain(`DuckDB pack ${duckdb.version}`);
  });

  it("pins the exact version these pages describe, after the templates' newest 1.x", () => {
    const choose = section(page, "## Choose the version you run");
    const version = JSON.parse(
      readFileSync(join(process.cwd(), "node_modules/@ingestron/cli/package.json"), "utf8"),
    ).version as string;
    expect(commands(choose)).toEqual([
      `npx --yes ingestron@${version} check`,
      `npm install -g ingestron@${version}`,
    ]);
    const templates = /run `(npx --yes ingestron@1 check)`/.exec(choose)![1]!;
    expect(read("how-to/check-in-ci.mdx")).toContain(`run: ${templates}`);
  });
});
