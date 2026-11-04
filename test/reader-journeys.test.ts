// The seams between pages: every platform page leads on, every deploy link
// lands on the section that deploys, a connector's page creates a project on
// each of its routes, and what the pages say about checks and run time is what
// the CLI does. Each command a page or component shows is run.
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectRoutes } from "@ingestron/cli";
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
import { cli, copy, fences, merge, read, section } from "./pages.js";

// Starters and connections are created and planned; resolving them takes seconds.
vi.setConfig({ testTimeout: 60_000 });

/** The page's heading anchors: `[#id]` where given, else the heading's slug. */
function anchors(text: string): Map<string, string> {
  const found = new Map<string, string>();
  let fenced = false;
  for (const line of text.split("\n")) {
    if (line.trimStart().startsWith("```")) fenced = !fenced;
    const heading = !fenced && /^#{2,6} (.*?)(?: \[#([^\]]+)\])?$/.exec(line);
    if (!heading) continue;
    const slug = heading[1]!
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .trim()
      .replace(/ +/g, "-");
    found.set(heading[2] ?? slug, heading[1]!);
  }
  return found;
}

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

  it("each ends with a Next list: add a source, plan and review, check in CI", () => {
    for (const page of pages) {
      const text = read(`platforms/${page}.mdx`);
      const next = section(text, "## Next");
      expect(text.trimEnd().endsWith(next.trimEnd()), `${page}: Next is last`).toBe(true);
      for (const href of [
        "/docs/how-to/add-a-source",
        "/docs/how-to/plan-and-generate",
        "/docs/how-to/check-in-ci",
      ])
        expect(next, `${page} → ${href}`).toContain(`](${href})`);
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

  it("says, where the route is offered, that DuckDB in Azure has not been run in a live subscription", () => {
    const status = routeRows().filter((row) => row.status);
    expect(status.map((row) => row.id)).toEqual(["adf-duckdb"]);
    const live = section(
      read("platforms/duckdb-in-azure.mdx"),
      "## Checked against live Azure: not yet",
    );
    expect(live).toContain("not");
    for (const html of [
      renderToStaticMarkup(createElement(RouteFacts, { id: "adf-duckdb" })),
      renderToStaticMarkup(createElement(RouteTable)),
      renderToStaticMarkup(createElement(RouteTable, { detail: true })),
    ]) {
      expect(html).toContain("Not yet run in a live Azure subscription");
      expect(html).toContain(
        'href="/docs/platforms/duckdb-in-azure#checked-against-live-azure-not-yet"',
      );
    }
    expect(renderToStaticMarkup(createElement(RouteFacts, { id: "adf-databricks" }))).not.toContain(
      "Status:",
    );
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
    expect(cli(cwd, ["apply", "--no-diff", "--env", "dev"]).code).toBe(0);
    const first = readFileSync(join(cwd, "build/dev/src/retail/bronze/orders.sql"), "utf8").split(
      "\n",
    )[0]!;
    expect(runTime.replace(/\n\s*/g, " ")).toContain(`\`${first}\``);
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

  it("deploys each environment's bundle by its own target, from its own folder", () => {
    const cwd = copy("retail");
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
    const environments = Object.keys(
      parse(readFileSync(join(cwd, "project.yaml"), "utf8")).environments,
    );
    expect(environments).toEqual(["dev", "prod"]);
    for (const environment of environments) {
      const bundle = parse(readFileSync(join(cwd, "build", environment, "databricks.yml"), "utf8"));
      expect(Object.keys(bundle.targets), environment).toEqual([environment]);
      expect(bundle.targets[environment].default, environment).toBe(true);
      expect(bundle.targets[environment].mode, environment).toBe(
        environment === "prod" ? "production" : "development",
      );
    }
    const ci = section(page, "### Deploy from a CI/CD pipeline");
    expect(fences(ci, "sh")).toEqual(["databricks bundle deploy -t prod\n"]);
    expect(ci).toContain("`build/prod/databricks.yml` holds the target `prod`");
    expect(ci).toContain("(/docs/how-to/check-in-ci)");
  });

  it("gives the refresh time the retail platform schedules, without naming a zone", () => {
    const platform = parse(readFileSync(join(exampleFolder("retail"), "platform.yaml"), "utf8"));
    const [, minute, hour] = String(platform.schedule.cron).split(" ");
    expect([hour, minute]).toEqual(["5", "0"]);
    const where = section(page, "### 3. Where things go").replace(/\s+/g, " ");
    expect(where).toContain("runs daily at 5 am in the time zone `schedule` names");
  });
});
