// The "Standards and teams" guides, run as they show them: each command is
// read from the page and run in a copy of the project the page names, each
// output block is compared with what the command prints, and each hand-written
// YAML fragment is merged into a sample and planned.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@ingestron/cli";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { PackNaming } from "../components/reference/pack-defaults";
import { exampleFolder, exampleRequest, requestSections } from "../lib/examples";
import { packName, packs } from "../lib/reference";

// Each test runs the command line against a copy of a sample, which takes seconds on a busy machine.
vi.setConfig({ testTimeout: 30_000 });
import {
  cli,
  command,
  commands,
  copy,
  fences,
  merge,
  read,
  requestUses,
  section,
} from "./pages.js";

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
    // The page renders the starter's request; a project created from it prints the same.
    expect(requestUses(section(page, "### Databricks"))).toEqual([{ name: "minimal", env: "dev" }]);
    const printed = request(page, shop(page));
    expect(printed.code).toBe(0);
    expect(printed.output.trim()).toBe(exampleRequest("minimal"));
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
      const [shown, ...more] = requestUses(route);
      expect(more, heading).toEqual([]);
      expect(shown?.name, heading).toBe(sample);
      expect(shown?.sections === undefined, `${heading}: the whole request`).toBe(whole);
      const printed = request(page, copy(sample));
      expect(printed.code, heading).toBe(0);
      if (shown?.sections)
        expect(printed.output, heading).toContain(
          `\n${requestSections(sample, "dev", shown.sections)}\n`,
        );
      else expect(printed.output.trim(), heading).toBe(exampleRequest(sample));
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
    // The standard, after a first line naming where it came from; init writes it back as
    // YAML, so only its formatting may differ, and each method's first window, which starts
    // on the day the project is created.
    expect(copied.split("\n")[0]).toBe(`# From ${path}`);
    const withoutStart = (yaml: string) => parse(yaml.replace(/^(\s*start: ).+$/gm, "$1<day>"));
    expect(withoutStart(copied)).toEqual(withoutStart(standard));
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
    // The page's command as written: init asks nothing.
    const asked: string[] = [];
    let output = "";
    const code = run(args, {
      cwd: local,
      write: (text) => (output += text),
      ask: (question) => (asked.push(question), ""),
    });
    const created = { code, output };
    expect(created.code, created.output).toBe(0);
    expect(asked, "init asks nothing").toEqual([]);
    // The template's value is still REPLACE_ME, and init says so.
    expect(created.output).toContain(
      "1 value is still REPLACE_ME: README.md lists each one and where to find it.",
    );
    const name = args[1]!;
    const copied = readFileSync(join(local, name, "standard.yaml"), "utf8");
    expect(copied.split("\n")[0]).toBe(`# From ${platformRepo}#${standard![2]!}`);
    // The same standard: init writes it back as YAML, so only its formatting may differ.
    expect(parse(copied)).toEqual(
      parse(
        readFileSync(join(exampleFolder("standards-and-conventions"), "standard.yaml"), "utf8"),
      ),
    );
    // The template came along: its flow, under the standard's names.
    expect(created.output).toContain(`src/${name}/raw/orders.sql`);
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
    const [catalog, schema, table] = /created as\n`` `([a-z_]+)`\.`([a-z_]+)`\.`([a-z_]+)` ``/
      .exec(patterns)!
      .slice(1);
    const file = /file="(build\/databricks\/src\/[^"]+)"/.exec(patterns)![1]!;
    const cwd = copy("standards-and-conventions");
    const out = join(cwd, "out");
    expect(cli(cwd, ["apply", "--no-diff", "--out", out]).code).toBe(0);
    expect(readFileSync(join(out, file.slice("build/".length)), "utf8")).toContain(
      `CREATE OR REFRESH STREAMING TABLE \`\${ingestron.schema_raw}\`.\`${table}\``,
    );
    const bundle = parse(readFileSync(join(out, "databricks/databricks.yml"), "utf8"));
    expect(bundle.targets.prod.variables.schema_raw).toBe(schema);
    const pipeline = parse(
      readFileSync(join(out, "databricks/resources/marketing.pipeline.yml"), "utf8"),
    );
    expect(pipeline.resources.pipelines.marketing.catalog).toBe(catalog);
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

  /** The first project, created with its page's own command. */
  function shop(): string {
    const create = commands(section(read("start/first-project.mdx"), "## 1. Create the project"));
    const init = create.find((line) => line.startsWith("ingestron init "))!;
    const parent = mkdtempSync(join(tmpdir(), "docs-upgrade-shop-"));
    expect(cli(parent, init.split(" ").slice(1)).code).toBe(0);
    return join(parent, create.find((line) => line.startsWith("cd "))!.slice("cd ".length));
  }

  it("stops the first project's plan when its standard names a major the command's pack lacks", () => {
    const pins = section(page, "## What the standard pins");
    expect(pins).toContain('<Example name="duckdb" file="standard.yaml" />');
    const cwd = shop();
    const standard = join(cwd, "standard.yaml");
    const text = readFileSync(standard, "utf8");
    expect(text).toContain("packs: [duckdb@2]");
    writeFileSync(standard, text.replace("duckdb@2", "duckdb@3"));
    const planned = cli(cwd, ["plan"]);
    expect(planned.code).toBe(1);
    expect(planned.output.trim()).toBe(fences(pins, "text")[0]!.trim());
    // The command has one version of each pack, and the page names DuckDB's.
    const duckdb = packs.find((pack) => pack.id === "duckdb")!;
    expect(pins).toContain(`DuckDB pack ${duckdb.version}`);
  });

  it("upgrades a 1.x standard with PACK_VERSION's fix, and names each 1.x folder until it is gone", () => {
    const steps = section(page, "### The standard and the folders");
    const [stopped, retired] = fences(steps, "text");
    const cwd = shop();
    const standard = join(cwd, "standard.yaml");
    writeFileSync(standard, readFileSync(standard, "utf8").replace("duckdb@2", "duckdb@1"));
    const planned = cli(cwd, ["plan"]);
    expect(planned.code).toBe(1);
    expect(planned.output.trim()).toBe(stopped!.trim());
    writeFileSync(standard, readFileSync(standard, "utf8").replace("duckdb@1", "duckdb@2"));
    // What 1.x left: a folder for the environment, with its manifest.
    mkdirSync(join(cwd, "build/dev"), { recursive: true });
    writeFileSync(join(cwd, "build/dev/.generated.json"), '{ "version": 1, "files": {} }\n');
    const applied = cli(cwd, ["apply", "--no-diff"]);
    expect(applied.code).toBe(0);
    expect(applied.output.trim().split("\n").at(-1)).toBe(retired!.trim());
    expect(cli(cwd, ["check"]).code).toBe(1);
    rmSync(join(cwd, "build/dev"), { recursive: true });
    expect(cli(cwd, ["check"]).code).toBe(0);
    // Every command but compare and request refuses --env.
    expect(cli(cwd, ["plan", "--env", "dev"]).code).toBe(2);
  });

  it("pins the exact bundle these pages describe, as the templates install it", () => {
    // The ingestron bundle these pages describe: the installed cli's version.
    const bundle = "2.2.0";
    const choose = section(page, "## Choose the version you run");
    const version = JSON.parse(
      readFileSync(join(process.cwd(), "node_modules/@ingestron/cli/package.json"), "utf8"),
    ).version as string;
    expect(bundle).toBe(version);
    expect(commands(choose)).toEqual([`npm install -g ingestron@${bundle}`]);
    for (const file of [
      "github-actions/ingestron-check.yml",
      "azure-devops/ingestron-check.yml",
      "github-actions/deploy.yml",
      "azure-devops/azure-pipelines.yml",
    ])
      expect(readFileSync(join(process.cwd(), "ci-templates", file), "utf8"), file).toContain(
        `: npm install -g ingestron@${bundle}\n`,
      );
    expect(read("how-to/check-in-ci.mdx")).toContain(`\`npm install -g ingestron@${bundle}\``);
  });
});
