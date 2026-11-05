// The command line and starters pages, run as they show themselves: each
// command is read from the page and run in a copy of a sample, and the pages
// that took over the old tools and examples pages keep what those taught.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builtInTemplates, listSamples } from "@ingestron/cli";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuiltInTemplates } from "../components/reference/built-in-templates";
import { SamplesCatalogue } from "../components/reference/samples-catalogue";
import { redirectFor } from "../worker/redirects.js";
import { cli, commands, copy, fences, merge, read, section } from "./pages.js";
import { contentFile, contentFolder } from "../lib/content-files.js";

const exists = (path: string) => existsSync(join(contentFolder, contentFile(path)));
const redirect = (path: string) => redirectFor(new URL(path, "https://docs.ingestron.io"));
const args = (line: string) => line.split(" ").slice(1);

/** A copy of a sample under the name `shop`, inside a new parent folder. */
function shopIn(sample: string): { parent: string; shop: string } {
  const parent = mkdtempSync(join(tmpdir(), "docs-cli-parent-"));
  const shop = join(parent, "shop");
  mkdirSync(shop);
  const source = copy(sample);
  for (const entry of readdirSync(source))
    cpSync(join(source, entry), join(shop, entry), { recursive: true });
  return { parent, shop };
}

describe("reference/cli", () => {
  const page = read("reference/cli.mdx");

  it("took over tools/cli: the old URL redirects, and the page keeps what that page taught", () => {
    expect(exists("tools/cli.mdx")).toBe(false);
    expect(redirect("/docs/tools/cli")).toBe("/docs/reference/cli");
    // The pages it linked to, the four options, the path rule.
    for (const link of [
      "(/docs/start/install)",
      "(/docs/how-to/start-from-a-template)",
      "(/docs/how-to/plan-and-generate)",
      "(/docs/how-to/check-in-ci)",
    ])
      expect(page).toContain(link);
    for (const option of ["--env dev", "--definitions <folder>", "--out <folder>", "--no-diff"])
      expect(page).toContain(`\`${option}\``);
    expect(page).toContain("are resolved from your current");
    expect(page).toContain("does not move the output folder");
    // The editor schemas: named here, explained in the VS Code guide the page links to.
    expect(page).toContain("(/docs/tools/vscode#check-files-with-the-yaml-extension)");
    expect(read("tools/vscode.mdx")).toContain(
      "## Check files with the YAML extension [#check-files-with-the-yaml-extension]",
    );
  });

  it("sends the builder API to the package README and no longer holds it", () => {
    expect(page).not.toContain("projectRecipe(");
    expect(page).not.toContain("ProjectSource");
    expect(page).toContain(
      "(https://github.com/ingestron/ingestron/tree/main/packages/cli#project-builder-api)",
    );
  });

  it("works on a project from outside it when both paths are set, and not with --definitions alone", () => {
    const [apply, check] = commands(section(page, "## Choose the project and the output"));
    expect(apply).toBe("ingestron apply --definitions shop --out shop/build");
    const { parent, shop } = shopIn("duckdb");
    expect(cli(parent, args(apply)).code).toBe(0);
    expect(existsSync(join(shop, "build", "duckdb", "dev"))).toBe(true);
    expect(cli(parent, args(check)).code).toBe(0);
    // With --definitions alone, the output goes under the folder you ran it from.
    const alone = shopIn("duckdb");
    expect(cli(alone.parent, ["apply", "--definitions", "shop"]).code).toBe(0);
    expect(existsSync(join(alone.parent, "build", "duckdb", "dev"))).toBe(true);
    expect(existsSync(join(alone.shop, "build"))).toBe(false);
  });

  it("limits compare and request to the named environments, refuses --env elsewhere, and plans without line differences on request", () => {
    const project = copy("environments");
    const all = cli(project, ["request"]);
    const dev = cli(project, ["request", "--env", "dev"]);
    expect(all.code).toBe(0);
    expect(dev.code).toBe(0);
    expect(all.output).toContain("# Platform request: finance (test)");
    expect(dev.output).not.toContain("# Platform request: finance (test)");
    for (const command of ["plan", "apply", "check"])
      expect(cli(project, [command, "--env", "dev"]).code, command).toBe(2);
    // An update has line differences; --no-diff lists the file without them.
    expect(cli(project, ["apply", "--no-diff"]).code).toBe(0);
    merge(join(project, "project.yaml"), "values:\n  landing: /Volumes/other/finance/files");
    const withDiff = cli(project, ["plan"]).output;
    const withoutDiff = cli(project, ["plan", "--no-diff"]).output;
    expect(withoutDiff.length).toBeLessThan(withDiff.length);
  });

  it("exits 0, 1 and 2 as the table says", () => {
    const table = section(page, "## Exit codes");
    for (const code of ["0", "1", "2"]) expect(table).toContain(`| \`${code}\``);
    const project = copy("duckdb");
    expect(cli(project, ["check"]).code).toBe(1);
    expect(cli(project, ["apply"]).code).toBe(0);
    expect(cli(project, ["check"]).code).toBe(0);
    expect(cli(project, ["--no-such-option"]).code).toBe(2);
  });

  it("writes each pack of a standard to a folder of its own, as the output section says", () => {
    expect(section(page, "## Output")).toContain("`build/databricks/`");
    const project = copy("private-sql-server");
    const applied = cli(project, ["apply", "--no-diff"]);
    expect(applied.code).toBe(0);
    expect(applied.output).toContain("databricks → build/databricks (dev, prod)");
    expect(readdirSync(join(project, "build")).sort()).toEqual(["adf", "databricks"]);
  });

  it("renders every command and option from the CLI", () => {
    expect(page).toContain("<CliCommands />");
  });
});

describe("tools/vscode: check files with the YAML extension", () => {
  const guide = section(
    read("tools/vscode.mdx"),
    "## Check files with the YAML extension [#check-files-with-the-yaml-extension]",
  );

  it("prints the setting the page shows", () => {
    expect(commands(guide)).toEqual(["ingestron schemas"]);
    const project = copy("duckdb");
    const result = cli(project, ["schemas"]);
    expect(result.code).toBe(0);
    expect(existsSync(join(project, ".ingestron", "schemas", "definitions.json"))).toBe(true);
    const shown = JSON.parse(fences(guide, "json")[0]!);
    const printed = JSON.parse(result.output.slice(result.output.indexOf("{")));
    expect(printed).toEqual(shown);
  });
});

describe("reference/templates", () => {
  const page = read("reference/templates.mdx");

  it("took over the example catalogue: the old URLs redirect, and the page keeps what it listed", () => {
    expect(exists("examples")).toBe(false);
    expect(redirect("/docs/examples/catalogue")).toBe("/docs/reference/templates");
    expect(redirect("/docs/examples")).toBe("/docs/reference/templates");
    // Downloads of the starters, then of the focused examples, each with its link.
    expect(page).toContain('<SamplesCatalogue kind="starter" />');
    expect(page).toContain('<SamplesCatalogue kind="guide" />');
    for (const link of [
      "(/docs/start/first-project)",
      "(/docs/platforms/adf)",
      "(/docs/how-to/start-from-a-template#from-a-downloaded-example)",
      "(/docs/how-to/share-a-template)",
    ])
      expect(page).toContain(link);
    expect(page).toContain("without generated");
    // Anchors that other pages link to.
    expect(page).toContain("## Built-in templates [#built-in-templates]");
  });

  it("creates a project from a starter in the CLI, and says VS Code's From a starter lists the same", () => {
    const [create] = commands(
      section(page, "## Create a project from a starter [#create-a-project-from-a-starter]"),
    );
    const parent = mkdtempSync(join(tmpdir(), "docs-templates-"));
    const result = cli(parent, args(create!));
    expect(result.code, result.output).toBe(0);
    expect(existsSync(join(parent, "my-project", "project.yaml"))).toBe(true);
    expect(page).toContain("**From a starter**");
    // VS Code lists builtInTemplates(), the table's rows.
    const table = renderToStaticMarkup(createElement(BuiltInTemplates));
    for (const template of builtInTemplates())
      expect(table).toContain(`<code>${template.name}</code>`);
  });

  it("lists a download for every starter and every focused example", () => {
    for (const kind of ["starter", "guide"] as const) {
      const html = renderToStaticMarkup(createElement(SamplesCatalogue, { kind }));
      const names = [...html.matchAll(/class="download-filename">([^<]+)\.zip</g)].map((m) => m[1]);
      expect(names.length, kind).toBeGreaterThan(0);
      if (kind === "starter") expect(names).toEqual(listSamples().map((sample) => sample.name));
    }
  }, 30_000);

  it("keeps the template.yaml fields and the files init copies", () => {
    for (const field of ["`title`", "`summary`", "`questions`", "`value`", "`ask`", "`default`"])
      expect(page).toContain(`| ${field}`);
    expect(page).toContain("`.generated.json`");
    expect(page).toContain("gitignore");
  });
});

describe("reference/packs", () => {
  const index = read("reference/packs/index.mdx");
  const reference = read("reference/packs/duckdb.mdx");
  const platform = read("platforms/duckdb.mdx");

  it("is reference only: the packs and what each writes, and the route table lives on choose-a-route", () => {
    for (const pack of ["databricks", "adf", "synapse", "duckdb"])
      expect(index).toContain(`(/docs/reference/packs/${pack})`);
    expect(index).toContain("(/docs/start/choose-a-route)");
    for (const gone of ["Supported combinations", "Required packs", "Container Apps", "<DocLinks"])
      expect(index).not.toContain(gone);
    expect(read("start/choose-a-route.mdx")).toContain("<RouteTable detail />");
  });

  it("leaves the DuckDB explanation to the platform page and the how-tos, and each page links to the other", () => {
    // What the reference page used to repeat from the platform page.
    const repeated = [
      "`append` reads each file name once",
      "A CSV without a header",
      "A transform's columns are cast to the contract's types",
      "`runs-on: duckdb` replaces",
      "Running again is safe in every mode",
    ];
    for (const text of repeated) expect(reference, text).not.toContain(text);
    // Each has one home: the platform page, or the how-to for modes and casts.
    const flat = (text: string) => text.replace(/\s+/g, " ");
    const homes: [string, string][] = [
      [
        "how-to/keep-a-table-current.mdx",
        "`append` adds each file's rows once: it reads each file name once",
      ],
      ["platforms/duckdb.mdx", "A CSV without a header"],
      ["how-to/write-a-transform.mdx", "A cast can change a value"],
      ["platforms/duckdb.mdx", "`runs-on: duckdb`"],
      ["how-to/keep-a-table-current.mdx", "Running again is safe in every mode"],
    ];
    for (const [home, text] of homes) expect(flat(read(home)), `${home}: ${text}`).toContain(text);
    expect(platform).toContain("(/docs/how-to/keep-a-table-current#on-duckdb)");
    expect(platform).toContain("(/docs/how-to/write-a-transform#what-each-engine-makes-of-it)");
    expect(reference).toContain("(/docs/platforms/duckdb)");
    expect(platform).toContain("(/docs/reference/packs/duckdb)");
    // What the reference page keeps: the pack's job, its order in `packs`, and its files.
    for (const text of [
      "packs: [duckdb@1, adf@1]",
      "`run.sql`",
      "`tables/`",
      '<PackMethods pack="duckdb" />',
    ])
      expect(reference).toContain(text);
  });
});

describe("the sidebar's last section", () => {
  it("has no index pages left in reference, tools or examples", () => {
    for (const path of ["reference/index.mdx", "tools/index.mdx", "tools/cli.mdx", "examples"])
      expect(exists(path), path).toBe(false);
    for (const section of ["/docs/reference", "/docs/tools", "/docs/examples"])
      expect(redirect(section), section).toBeDefined();
    expect(readFileSync(join(process.cwd(), "worker/redirects.js"), "utf8")).toContain(
      "/docs/tools/cli",
    );
  });
});
