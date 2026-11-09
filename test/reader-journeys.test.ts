// The seams between pages: every platform page leads on, every deploy link
// lands on the section that deploys, a connector's page creates a project on
// each of its routes, and what the pages say about checks and run time is what
// the CLI does. Each command a page or component shows is run.
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectRoutes } from "@ingestron/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConnectorFacts } from "../components/reference/connector-facts";
import { ExamplesList } from "../components/reference/examples-list";
import { RouteFacts } from "../components/reference/route-facts";
import { RouteList } from "../components/reference/route-list";
import { RouteTable } from "../components/reference/route-table";
import { exampleFolder, listExamples } from "../lib/examples";
import { routeRows } from "../lib/routes";
import { parse } from "yaml";
import { anchors, cli, copy, fences, merge, read, section } from "./pages.js";

// Starters and connections are created and planned; resolving them takes seconds.
vi.setConfig({ testTimeout: 60_000 });

/** The text of every `<code>` element in some HTML. */
const codes = (html: string) =>
  [...html.matchAll(/<code>(.*?)<\/code>/g)].map((match) => match[1]!.replace(/&lt;/g, "<"));

/** Runs an `ingestron init …` line in a new folder, taking the defaults for what it would ask. */
function create(line: string): { code: number; output: string; cwd: string } {
  const parent = mkdtempSync(join(tmpdir(), "docs-journey-"));
  const args = line.split(" ").slice(1);
  const created = cli(parent, [...args, "--yes"]);
  return { ...created, cwd: join(parent, args[1]!) };
}

describe("platform pages", () => {
  const pages = [
    "adf",
    "adf-pipelines",
    "databricks",
    "duckdb",
    "duckdb-in-azure",
    "landing-only",
    "synapse",
  ];

  it("each ends with a Next list of three links chosen for it, not one list for all", () => {
    const lists = new Map<string, string>();
    for (const page of pages) {
      const text = read(`platforms/${page}.mdx`);
      const next = section(text, "## Next");
      expect(text.trimEnd().endsWith(next.trimEnd()), `${page}: Next is last`).toBe(true);
      const links = [...next.matchAll(/^- \[[^\]]+\]\((\/docs\/[^)]+)\)/gm)].map(
        (match) => match[1]!,
      );
      expect(links, `${page}: three links`).toHaveLength(3);
      const key = [...links].sort().join(" ");
      expect(lists.get(key), `${page} has the same Next list as ${lists.get(key)}`).toBeUndefined();
      lists.set(key, page);
    }
  });
});

describe("routes", () => {
  it("links each route's deploy step to the heading on its guide that deploys it", () => {
    for (const row of routeRows()) {
      const [path, hash] = row.deployAt.slice("/docs/".length).split("#");
      const headings = anchors(read(`${path}.mdx`));
      // A numbered step's heading, such as "4. Build the tables", without its number.
      expect(headings.get(hash!)?.replace(/^\d+\. /, ""), row.deployAt).toBe(row.deployStep);
    }
  });

  it("lists every route, from plan-and-generate's deploy step and the template page's next step", () => {
    expect(read("how-to/plan-and-generate.mdx")).toContain("<RouteList deploy />");
    expect(read("how-to/start-from-a-template.mdx")).toContain("<RouteList />");
    expect(read("how-to/plan-and-generate.mdx")).not.toContain('href: "/docs/reference/packs"');
    const deploy = renderToStaticMarkup(createElement(RouteList, { deploy: true }));
    const guides = renderToStaticMarkup(createElement(RouteList));
    for (const row of routeRows()) {
      expect(deploy, row.id).toContain(`href="${row.deployAt}"`);
      expect(guides, row.id).toContain(`href="/docs/${row.guide}"`);
    }
    expect(deploy.match(/<li>/g)).toHaveLength(routeRows().length);
  });

  it("says what DuckDB in Azure has run, on its page, and no route carries a status", () => {
    const page = read("platforms/duckdb-in-azure.mdx");
    const ran = section(page, "### What has run in Azure");
    expect(ran).toContain('<OldAnchor id="checked-against-live-azure-not-yet" />');
    expect(ran).toContain("ingestron 1.8 on 2 November 2026, in one demo\nsubscription");
    for (const point of ["**Starting the job:**", "**Signing in:**", "**Running again:**"])
      expect(ran).toContain(point);
    expect(page).not.toContain("not yet");
    for (const html of [
      renderToStaticMarkup(createElement(RouteFacts, { id: "adf-duckdb" })),
      renderToStaticMarkup(createElement(RouteTable)),
      renderToStaticMarkup(createElement(RouteTable, { detail: true })),
    ]) {
      expect(html).not.toContain("Status:");
      expect(html).not.toContain("Not yet run");
    }
  });
});

describe("connector pages", () => {
  it("create a project on each route the connector offers, with a command that runs", () => {
    for (const id of ["sqlserver", "files", "salesforce"]) {
      const lines = codes(renderToStaticMarkup(createElement(ConnectorFacts, { id }))).filter(
        (code) => code.startsWith("ingestron init ") && code.includes("--connector"),
      );
      const vias = projectRoutes(id).map((route) => route.via);
      expect(lines.map((line) => /--via (\S+)/.exec(line)![1]).sort(), id).toEqual(
        [...new Set(vias)].sort(),
      );
      for (const line of lines) {
        const created = create(line);
        expect(created.code, `${line}\n${created.output}`).toBe(0);
        expect(cli(created.cwd, ["plan", "--no-diff"]).code, line).toBe(0);
      }
    }
  });

  it("list the starters that read the connector, the DuckDB starter first on the Files page", () => {
    const files = renderToStaticMarkup(createElement(ConnectorFacts, { id: "files" }));
    const starters = codes(files).filter((code) => code.includes("--template"));
    expect(starters[0]).toBe("ingestron init shop --template duckdb");
    expect(files).toContain("DuckDB on a laptop (DuckDB)");
    const reading = listExamples().filter(
      (example) => example.template && example.facts.connectors.includes("files"),
    );
    expect(starters).toHaveLength(reading.length);
    // A connector no starter reads has no starters section.
    expect(renderToStaticMarkup(createElement(ConnectorFacts, { id: "postgresql" }))).not.toContain(
      "<h3>Starters</h3>",
    );
  });

  it("offer each starter's command beside its download, and the command creates it", () => {
    const html = renderToStaticMarkup(createElement(ExamplesList, { connector: "sqlserver" }));
    const lines = codes(html).filter((code) => code.includes("--template"));
    expect(lines).toEqual([
      "ingestron init sales --template private-sql-server",
      "ingestron init sales --template sql-server",
    ]);
    for (const line of [...lines, "ingestron init shop --template duckdb"]) {
      const created = create(line);
      expect(created.code, `${line}\n${created.output}`).toBe(0);
    }
  });
});

describe("how-to/add-quality-checks", () => {
  const table = read("how-to/add-quality-checks.mdx").split("\n## ")[0]!.split("\n\n")[2]!;
  const row = (link: string) => table.split("\n").find((line) => line.includes(`](${link})`))!;

  /** Plans a copy of a sample after giving one table an expectation, the way the guide adds one. */
  function plan(folder: string, flow: string, table: string): string {
    const cwd = mkdtempSync(join(tmpdir(), "docs-quality-"));
    cpSync(folder, cwd, { recursive: true });
    merge(
      join(cwd, flow),
      `tables:\n  ${table}:\n    expectations:\n      - { name: has_rows, check: "1 = 1" }\n`,
    );
    return cli(cwd, ["plan", "--no-diff"]).output;
  }

  it("says what each engine does with a check, as the CLI reports it", () => {
    expect(row("/docs/platforms/databricks")).toContain("Runs them");
    const databricks = plan(exampleFolder("quality"), "flows/readings.yaml", "readings");
    expect(databricks).not.toContain("error");

    const duckdb = plan(exampleFolder("duckdb"), "flows/orders.yaml", "orders");
    expect(duckdb).toContain("error  METHOD_CHECK");
    expect(duckdb).toContain("DuckDB tables check no rows yet");
    expect(row("/docs/platforms/duckdb")).toContain("`METHOD_CHECK`");

    const synapse = plan(exampleFolder("synapse-views"), "flows/erp.yaml", "customers");
    expect(synapse).not.toContain("error");
    expect(synapse).not.toContain("has_rows");
    expect(synapse).toContain("warning  CONTRACT_FIELD_UNUSED");
    expect(synapse).toContain("Synapse views check no rows.");
    expect(row("/docs/platforms/synapse")).toContain("`expectations` are not run");
    expect(row("/docs/platforms/synapse")).toContain("`CONTRACT_FIELD_UNUSED`");

    const landing = plan(exampleFolder("landing-only"), "flows/erp.yaml", "customers");
    expect(landing).not.toContain("error");
    expect(landing).toContain("warning  QUALITY_RULE_NOT_CHECKED");
    expect(row("/docs/platforms/landing-only")).toContain("`QUALITY_RULE_NOT_CHECKED`");
  });

  it("is linked from the DuckDB page, which says checks are an error there", () => {
    const duckdb = read("platforms/duckdb.mdx");
    expect(duckdb).toContain("DuckDB tables check no rows yet");
    expect(duckdb).toContain("(/docs/how-to/add-quality-checks)");
  });
});

describe("concepts/generated-files", () => {
  const runTime = section(
    read("concepts/generated-files.mdx"),
    "## Nothing of Ingestron at run time",
  );

  it("quotes the header line the Databricks pack writes", () => {
    const cwd = copy("retail");
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
    const first = readFileSync(
      join(cwd, "build/databricks/src/retail/bronze/orders.sql"),
      "utf8",
    ).split("\n")[0]!;
    expect(runTime.replace(/\n\s*/g, " ")).toContain(`\`${first}\``);
  });

  it("says which ADF pipelines carry the annotation, as the pack writes them", () => {
    const annotations = (name: string) => {
      const cwd = copy(name);
      expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
      const folder = join(cwd, "build/adf/factory/pipeline");
      return readdirSync(folder).map(
        (file) => JSON.parse(readFileSync(join(folder, file), "utf8")).properties.annotations,
      );
    };
    // adf-copy: every pipeline starts with Ingestron's line; adf-table: none without the tables'.
    expect(annotations("synapse-views")).toEqual([
      ["Generated by Ingestron from the sales definitions"],
    ]);
    expect(annotations("connection-first-adf")).toEqual([undefined]);
    const text = runTime.replace(/\s+/g, " ");
    expect(text).toContain("`Generated by Ingestron from the <project> definitions`");
    expect(text).toContain("An `adf-table` pipeline has them only when its tables add some");
  });

  it("says plan reports a differing file as a conflict when .generated.json is gone", () => {
    const cwd = copy("duckdb");
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
    rmSync(join(cwd, "build/duckdb/.generated.json"));
    appendFileSync(join(cwd, "build/duckdb/dev/run.sql"), "-- mine\n");
    const planned = cli(cwd, ["plan", "--no-diff"]);
    expect(planned.code).toBe(1);
    expect(planned.output).toMatch(/^conflict +dev\/run\.sql$/m);
    expect(planned.output).toMatch(/^adopt +dev\/README\.md$/m);
    expect(runTime.replace(/\s+/g, " ")).toContain(
      "reports every file that differs from what it would generate as a conflict",
    );
  });

  it("names the one image Ingestron runs, and is what the home page links for no dependency", () => {
    expect(runTime).toContain("`ghcr.io/ingestron/duckdb-runner`");
    expect(read("index.mdx")).toContain(
      "(/docs/concepts/generated-files#nothing-of-ingestron-at-run-time)",
    );
  });
});

describe("small promises", () => {
  it("gives the VS Code extension's version on the Versions page", () => {
    expect(read("reference/versions.mdx")).toContain("<ExtensionVersion />");
    const { version } = JSON.parse(
      readFileSync(join(process.cwd(), "components/reference/vscode-extension.json"), "utf8"),
    ) as { version: string };
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("lists the same files init leaves out on the template guide and the reference", () => {
    // The names between "except" or "apart from" and the end of that list.
    const left = (text: string) =>
      /(?:file except|apart from) ([\s\S]*?)(?:, and refuses|\. A file)/
        .exec(text)![1]!
        .match(/`[^`]+`/g)!
        .map((name) => name.replace(/[`/]/g, ""))
        .sort();
    expect(left(read("how-to/share-a-template.mdx"))).toEqual(
      left(read("reference/templates.mdx")),
    );
  });
});

describe("platforms/databricks", () => {
  const page = read("platforms/databricks.mdx");

  it("deploys one bundle, target by target, from build/databricks", () => {
    const cwd = copy("retail");
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
    const environments = Object.keys(
      parse(readFileSync(join(cwd, "project.yaml"), "utf8")).environments,
    );
    expect(environments).toEqual(["dev", "prod"]);
    const bundle = parse(readFileSync(join(cwd, "build/databricks/databricks.yml"), "utf8"));
    expect(Object.keys(bundle.targets)).toEqual(environments);
    expect(bundle.targets.dev.default).toBe(true);
    expect(bundle.targets.dev.mode).toBe("development");
    expect(bundle.targets.prod.mode).toBe("production");
    expect(existsSync(join(cwd, "build/dev"))).toBe(false);

    const deployPage = read("platforms/databricks-deploy.mdx");
    const deploy = section(deployPage, "## Deploy");
    expect(fences(deploy, "sh")[0]).toBe(
      "cd build/databricks\ndatabricks bundle validate -t dev\ndatabricks bundle deploy -t dev\n",
    );
    // Deploying as one identity: a shared root_path, and binding what another identity deployed.
    const identity = section(deployPage, "### Deploy as one identity");
    expect(identity).toContain(
      '<Example name="environments" file="platform.yaml" pick="workspace" />',
    );
    expect(fences(identity, "sh")[0]).toContain(
      "databricks bundle deployment bind <key> <id> -t prod",
    );
    const platform = parse(
      readFileSync(join(exampleFolder("environments"), "platform.yaml"), "utf8"),
    );
    expect(platform.workspace.root_path).toMatch(/^\/Workspace\/Shared\//);
    expect(section(page, "## Deploy and run")).toContain("(/docs/platforms/databricks-deploy)");
    const ci = section(deployPage, "### From CI");
    expect(ci).toContain('file="github-actions/deploy-environment.yml"');
    expect(ci).toContain("(/docs/how-to/deploy-through-environments)");
  });

  it("says only dev is in development mode, and the schedule runs only in prod", () => {
    const cwd = copy("environments");
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
    const { targets } = parse(readFileSync(join(cwd, "build/databricks/databricks.yml"), "utf8"));
    expect([targets.dev.mode, targets.test.mode, targets.prod.mode]).toEqual([
      "development",
      "production",
      "production",
    ]);
    // test is in production mode, so its schedule is paused by a preset; prod's runs.
    expect(targets.test.presets.trigger_pause_status).toBe("PAUSED");
    expect(targets.prod.presets.trigger_pause_status).toBeUndefined();
    const settings = section(page, "## Settings that shape it").replace(/\s+/g, " ");
    expect(settings).toContain("Only an environment named `dev` is in development mode");
    expect(settings).toContain("The schedule runs only in `prod` or `production`");
  });
});
