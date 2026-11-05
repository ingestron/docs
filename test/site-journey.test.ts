import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoutes } from "@ingestron/cli";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RelatedSetup } from "../components/reference/related-setup";
import { RouteComparison } from "../components/reference/route-comparison";
import { RouteFacts } from "../components/reference/route-facts";
import { RouteTable } from "../components/reference/route-table";
import { allRoutes, packName, routePacks } from "../lib/reference";
import { routeRows } from "../lib/routes";
import { redirectFor } from "../worker/redirects.js";
import { section } from "./pages.js";
import { contentFile, contentFolder } from "../lib/content-files.js";

const read = (path: string) => readFileSync(join(contentFolder, contentFile(path)), "utf8");

it("opens with one learning path, then areas by the reader's job, with no index pages", () => {
  const root = JSON.parse(read("meta.json"));
  expect(root.pages).not.toContain("tutorials");
  // The home page, then the seven areas; each area is a root folder (test/areas.test.ts).
  expect(root.pages).toEqual([
    "index",
    "start",
    "how-to/(build)",
    "platforms",
    "how-to/(standards)",
    "concepts",
    "connectors",
    "(reference)",
  ]);
  // Get started lists its pages in reading order, not an index page of links.
  expect(JSON.parse(read("start/meta.json")).pages).toEqual([
    "first-project",
    "how-it-works",
    "choose-a-route",
    "install",
  ]);
  expect(existsSync(join(contentFolder, contentFile("start/index.mdx")))).toBe(false);
  // The guides keep their how-to/ URLs in two folder groups: Build a project, and Standards and teams.
  expect(JSON.parse(read("how-to/(build)/meta.json")).pages).toEqual([
    "start-from-a-template",
    "add-a-source",
    "write-a-contract",
    "write-a-transform",
    "keep-a-table-current",
    "add-quality-checks",
    "define-a-data-product",
    "add-an-environment",
    "plan-and-generate",
    "check-in-ci",
    "deploy-through-environments",
  ]);
  expect(JSON.parse(read("how-to/(standards)/meta.json")).pages).toEqual([
    "configure-a-standard",
    "name-things-your-way",
    "ask-the-platform-team",
    "share-a-template",
    "upgrade",
  ]);
  expect(JSON.parse(read("concepts/meta.json")).pages).toEqual([
    "definitions",
    "standards-and-packs",
    "settings",
    "layers",
    "environments-and-platform",
    "yaml-references",
    "generated-files",
  ]);
  // The two section indexes are gone, and their URLs land on each section's first page.
  for (const [section, first] of [
    ["how-to", "how-to/start-from-a-template"],
    ["concepts", "concepts/definitions"],
  ] as const) {
    expect(existsSync(join(contentFolder, contentFile(`${section}/index.mdx`))), section).toBe(
      false,
    );
    expect(redirectFor(new URL(`https://docs.ingestron.io/docs/${section}`))).toBe(
      `/docs/${first}`,
    );
  }
  // Reference is the last area: each reference page, VS Code and troubleshooting.
  expect(JSON.parse(read("(reference)/meta.json")).pages).toEqual([
    "...reference",
    "...tools",
    "troubleshooting",
  ]);
  expect(JSON.parse(read("reference/meta.json")).pages).toEqual([
    "documents",
    "packs",
    "errors",
    "cli",
    "templates",
    "versions",
  ]);
  expect(JSON.parse(read("tools/meta.json")).pages).toEqual(["vscode"]);
  // The reference, tools and examples indexes are gone, and their URLs land on a page.
  for (const [section, first] of [
    ["reference", "reference/documents"],
    ["tools", "tools/vscode"],
    ["examples", "reference/templates"],
  ] as const) {
    expect(existsSync(join(contentFolder, contentFile(`${section}/index.mdx`))), section).toBe(
      false,
    );
    expect(redirectFor(new URL(`https://docs.ingestron.io/docs/${section}`))).toBe(
      `/docs/${first}`,
    );
  }
  // The packs page is reference, not a list of links, and keeps its index.
  expect(JSON.parse(read("reference/packs/meta.json")).pages).toEqual([
    "databricks",
    "adf",
    "synapse",
    "duckdb",
  ]);
  expect(existsSync(join(contentFolder, contentFile("reference/packs/index.mdx")))).toBe(true);
});

it("merges the downloaded-example guide and moves the contract guide, keeping their anchors", () => {
  for (const [old, target, heading] of [
    [
      "how-to/use-an-example",
      "/docs/how-to/start-from-a-template#start-from-a-starter",
      "## Start from a starter [#start-from-a-starter]",
    ],
    [
      "how-to/draft-a-contract-from-a-sample",
      "/docs/how-to/write-a-contract#draft-from-a-sample",
      "## Draft from a sample [#draft-from-a-sample]",
    ],
  ] as const) {
    expect(existsSync(join(contentFolder, contentFile(`${old}.mdx`))), old).toBe(false);
    expect(redirectFor(new URL(`https://docs.ingestron.io/docs/${old}`))).toBe(target);
    expect(read(`${target.slice("/docs/".length).split("#")[0]}.mdx`)).toContain(heading);
  }
  // What the downloaded-example guide said lives on: the download, and adapting it.
  const create = read("how-to/start-from-a-template.mdx");
  for (const text of [
    "### From a downloaded example",
    "## Make it yours",
    "without generated files",
  ])
    expect(create).toContain(text);
  // The contract prose moved from the document reference to the guide.
  const contract = read("how-to/write-a-contract.mdx");
  for (const field of ["physicalName", "primaryKeyPosition", "QUALITY_RULE_NOT_CHECKED"])
    expect(contract).toContain(field);
  expect(read("reference/documents.mdx")).toContain("(/docs/how-to/write-a-contract)");
});

it("merges the worked standard and the naming concept into their guides, keeping what they taught", () => {
  for (const [old, target] of [
    ["examples/organisation-standards", "/docs/how-to/configure-a-standard"],
    ["concepts/naming", "/docs/how-to/name-things-your-way"],
  ] as const) {
    expect(existsSync(join(contentFolder, contentFile(`${old}.mdx`))), old).toBe(false);
    expect(redirectFor(new URL(`https://docs.ingestron.io/docs/${old}`))).toBe(target);
  }
  expect(existsSync(join(contentFolder, contentFile("examples")))).toBe(false);
  // The worked standard: the file explained, generated, and broken on purpose.
  const standard = read("how-to/configure-a-standard.mdx");
  expect(standard).toContain("title: Set your organisation's standard");
  for (const text of [
    "## What a standard holds [#what-a-standard-holds]",
    '<Example name="standards-and-conventions" file="standard.yaml" />',
    "## Try it on a project [#try-it-on-a-project]",
    '<Example name="standards-and-conventions" file="exercises/fixed-setting.yaml" />',
    "FIXED_SETTING",
    "## Start each project from it",
    "## Keep projects to it",
    "## Require governance of data products",
  ])
    expect(standard).toContain(text);
  // The naming concept: variables, every pack's defaults, valid names, ADF and renames.
  const naming = read("how-to/name-things-your-way.mdx");
  expect(naming).toContain("title: Name tables and resources");
  for (const text of [
    "<NamingVariables />",
    "<PackNaming />",
    "{% if source %}",
    "BAD_NAME",
    "BAD_PATTERN",
    "DUPLICATE_NAME",
    "## ADF resource names",
    "### Choose where the name belongs",
    '<OldAnchor id="review-a-rename-before-applying" />',
    "Ingestron renames files, not data.",
  ])
    expect(naming).toContain(text);
  // Its table of identities moved to the definitions concept.
  const definitions = read("concepts/definitions.mdx");
  expect(definitions).toContain("## IDs and names");
  for (const identity of ["Project and definition IDs", "Project table name", "Contract link"])
    expect(definitions).toContain(`| ${identity}`);
  // Each new page is linked where its subject first comes up.
  expect(read("how-to/write-a-transform.mdx")).toContain("[second layer](/docs/concepts/layers)");
  expect(read("how-to/add-a-source.mdx")).toContain("[first layer](/docs/concepts/layers)");
  expect(read("how-to/check-in-ci.mdx")).toContain(
    "(/docs/how-to/upgrade#choose-the-version-you-run)",
  );
});

it("starts each kind of reader on the home page, before its value story", () => {
  const home = read("index.mdx");
  const start = section(home, "## Start here");
  for (const [reader, links] of [
    ["Data engineers", ["#run-it-on-your-laptop", "/docs/start/first-project"]],
    ["Platform teams", ["/docs/how-to/configure-a-standard", "/docs/how-to/ask-the-platform-team"]],
  ] as const) {
    const path = start.split("<Path ").find((item) => item.startsWith(`reader="${reader}"`));
    expect(path, reader).toBeDefined();
    for (const link of links) expect(path, `${reader} → ${link}`).toContain(`(${link})`);
  }
  expect(start).toContain("(/docs/start/choose-a-route)");
  // The ways in come first, then what Ingestron does and the laptop run.
  const headings = home.split("\n").filter((line) => line.startsWith("## "));
  expect(headings.slice(0, 3)).toEqual([
    "## Start here",
    "## What Ingestron does",
    "## Run it on your laptop",
  ]);
});

it("runs the first project with no cloud account, source or deployment", () => {
  const first = read("start/first-project.mdx");
  expect(first).toContain("No cloud account");
  expect(first).toContain('<Example name="duckdb" file="build/duckdb/dev/run.sql" />');
  const commands = [...first.matchAll(/^```sh\n([\s\S]*?)^```$/gm)].flatMap((match) =>
    match[1]!.trimEnd().split("\n"),
  );
  expect(commands.length).toBeGreaterThan(0);
  // Only Ingestron, DuckDB and the shell: no cloud command line, nothing deployed.
  for (const command of commands)
    expect(command).toMatch(
      /^(npm install -g ingestron$|ingestron |cd |duckdb |rm build\/|ls published$)/,
    );
});

it("installs Ingestron first, then runs every command as ingestron, never through npx", () => {
  // The home page, the first project and Install a tool install globally from npm.
  for (const page of ["index.mdx", "start/first-project.mdx", "start/install.mdx"]) {
    const sh = [...read(page).matchAll(/^```sh\n([\s\S]*?)^```$/gm)].map((match) => match[1]!);
    expect(
      sh.some((block) => block.startsWith("npm install -g ingestron\n")),
      page,
    ).toBe(true);
  }
  expect(read("start/first-project.mdx")).toContain("Node.js 22.13 or later");
  expect(read("start/install.mdx")).toContain("Node.js 22.13 or later");
  // No page, component or CI template runs it through npx.
  const files = [
    ...readdirSync(join(process.cwd(), "content/docs"), { recursive: true })
      .map(String)
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => join("content/docs", file)),
    ...readdirSync(join(process.cwd(), "components"), { recursive: true })
      .map(String)
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => join("components", file)),
    "ci-templates/github-actions/ingestron-check.yml",
    "ci-templates/azure-devops/ingestron-check.yml",
  ];
  expect(files.length).toBeGreaterThan(100);
  for (const file of files)
    expect(readFileSync(join(process.cwd(), file), "utf8"), file).not.toMatch(/npx\b/);
});

it("keeps the front door's claims to what is shown and measured", () => {
  for (const page of [
    "index.mdx",
    "start/first-project.mdx",
    "start/how-it-works.mdx",
    "start/choose-a-route.mdx",
  ]) {
    const text = read(page);
    expect(text, page).not.toMatch(/\b(just|simply|seamless(ly)?)\b/i);
    expect(text, page).not.toMatch(/\b\d+\s*(seconds?|minutes?|hours?)\b/i);
    expect(text, page).not.toMatch(/\bcommunity\b/i);
  }
  // No dependency once deployed, with the one exception named where the claim is made.
  expect(read("start/how-it-works.mdx")).toContain("ghcr.io/ingestron/duckdb-runner:1");
  expect(read("index.mdx")).toContain("DuckDB in Azure runs in a public container image");
});

it("makes YAML reference syntax reachable from every page and from concepts", () => {
  // The header's links, on every page of every area and on the home page.
  const layout = readFileSync(join(process.cwd(), "lib/layout.shared.tsx"), "utf8");
  expect(layout).toContain('url: "/docs/concepts/yaml-references"');
  expect(read("start/how-it-works.mdx")).toContain("/docs/concepts/yaml-references");
  expect(JSON.parse(read("concepts/meta.json")).pages).toContain("yaml-references");
  const syntax = read("concepts/yaml-references.mdx");
  for (const form of [
    "${values.",
    "${project.id}",
    "${environment.name}",
    "${file:",
    "${secret:",
    "${envvar:",
    "$${",
    "{{",
  ])
    expect(syntax).toContain(form);
  expect(syntax).toContain("VALUES_SELF_REFERENCE");
  expect(syntax).toContain("UNKNOWN_CODE_VALUE");
});

it("explains environment files where the editor and the other pages send readers", () => {
  const syntax = read("concepts/yaml-references.mdx");
  expect(syntax).toContain("## Use environment files");
  for (const text of [".env.<environment>", ".env.example", "!.env.example", "ENV_FILE_LINE"])
    expect(syntax).toContain(text);
  for (const page of [
    "tools/vscode.mdx",
    "how-to/check-in-ci.mdx",
    "how-to/start-from-a-template.mdx",
  ])
    expect(read(page)).toContain("/docs/concepts/yaml-references#use-environment-files");
});

it("separates the core workflow from today's supported platform combinations", () => {
  const routes = read("start/choose-a-route.mdx");
  expect(routes).toContain("<RouteTable detail />");
  expect(routes).toContain("## Reachability");
  expect(routes).toContain("Naming another platform in the\nYAML does not add one.");
  const html = renderToStaticMarkup(createElement(RouteTable, { detail: true }));
  const rows = [...html.matchAll(/<tr>(.*?)<\/tr>/g)].map((match) => match[1]!).slice(1);
  // The starter, then every route New project offers, each with its guide.
  expect(rows).toHaveLength(1 + allRoutes().length);
  expect(rows[0]).toContain("<code>--template duckdb</code>");
  expect(rows[0]).toContain('href="/docs/platforms/duckdb"');
  allRoutes().forEach(({ via, title }, index) => {
    expect(rows[index + 1]).toContain(title);
    expect(rows[index + 1]).toContain(`<code>--via ${via}</code>`);
    expect(rows[index + 1]).toMatch(/href="\/docs\/platforms\/[a-z-]+"/);
  });
  expect(html).toContain("ADF ingestion, ending at the landed files");
  expect(html).toContain('href="/docs/platforms/duckdb-in-azure"');
  expect(read("index.mdx")).toContain("<RouteTable />");
  // The combinations live here, with the packs each route needs; the pack index is reference only.
  allRoutes().forEach(({ via }, index) =>
    expect(rows[index + 1], `${via} packs`).toContain(routePacks(via).map(packName).join(" + ")),
  );
  const packs = read("reference/packs/index.mdx");
  expect(packs).toContain("(/docs/start/choose-a-route)");
  expect(packs).not.toContain("Supported combinations");
  expect(packs).not.toContain("Required packs");
  expect(read("platforms/duckdb-in-azure.mdx")).toContain("ghcr.io/ingestron/duckdb-runner:1");
  expect(read("how-to/plan-and-generate.mdx")).toContain("does not deploy");
});

it("gives each route a platform page that opens with what runs, what deploys and how to create it", () => {
  expect(JSON.parse(read("meta.json")).pages).toContain("platforms");
  expect(JSON.parse(read("platforms/meta.json")).root).toBe(true);
  const platforms = JSON.parse(read("platforms/meta.json")).pages as string[];
  expect(platforms).toEqual([
    "duckdb",
    "duckdb-in-azure",
    "databricks",
    "synapse",
    "adf",
    "adf-pipelines",
    "landing-only",
  ]);
  // Moved or merged, not copied: the old guides are gone, and their URLs redirect.
  for (const old of [
    "how-to/run-locally-with-duckdb",
    "how-to/run-duckdb-in-azure",
    "how-to/serve-files-as-sql",
    "how-to/land-files-only",
    "how-to/databricks",
    "how-to/deploy-the-bundle",
    "how-to/manage-schemas",
    "how-to/refresh-on-a-schedule",
    "examples/retail",
    "how-to/adf",
    "how-to/adf-native-connectors",
    "how-to/adf-runtime",
    "how-to/publish-adf",
    "how-to/design-adf-pipelines",
    "how-to/name-adf-resources",
  ])
    expect(existsSync(join(contentFolder, contentFile(`${old}.mdx`))), old).toBe(false);
  for (const [id, page] of [
    ["duckdb", "duckdb"],
    ["adf-duckdb", "duckdb-in-azure"],
    ["databricks", "databricks"],
    ["adf-synapse", "synapse"],
    ["adf-databricks", "adf"],
    ["adf-landing", "landing-only"],
  ] as const) {
    const text = read(`platforms/${page}.mdx`);
    expect(routeRows().find((row) => row.id === id)?.guide, id).toBe(`platforms/${page}`);
    // Before the first heading, so it is the first thing a reader meets.
    expect(text.split("\n## ")[0], page).toContain(`<RouteFacts id="${id}" />`);
    const row = routeRows().find((item) => item.id === id)!;
    const facts = renderToStaticMarkup(createElement(RouteFacts, { id }));
    expect(facts).toContain("After each load:");
    expect(facts).toContain("Deploy with:");
    expect(facts).toContain(
      `<code>ingestron init ${id === "duckdb" ? "shop" : "sales --connector"}`,
    );
    expect(facts).toContain(row.option);
  }
  expect(existsSync(join(contentFolder, contentFile("platforms/index.mdx")))).toBe(false);
  // The ADF page is the setup for every route ADF feeds, and says so before its first heading.
  const adf = read("platforms/adf.mdx").split("\n## ")[0]!;
  for (const via of ["adf-synapse", "adf-duckdb", "adf-landing"]) {
    expect(adf, via).toContain(`(/docs/${routeRows().find((row) => row.id === via)!.guide})`);
    expect(adf, via).toContain(`\`${via}\``);
  }
});

it("keeps the Databricks worked example: dev and prod, with its break in troubleshooting", () => {
  const page = read("platforms/databricks.mdx");
  const create = section(page, "## Create it");
  for (const file of ["standard.yaml", "project.yaml", "flows/shop.yaml"])
    expect(create).toContain(`<Example name="retail" file="${file}" />`);
  expect(create).toContain("ingestron init retail --template retail");
  expect(page).toContain('<OldAnchor id="work-through-the-retail-project" />');
  // The deliberate break lives with its symptom, not on the platform page.
  expect(page).not.toContain("DUPLICATE_TABLE");
  expect(read("troubleshooting.mdx")).toContain("DUPLICATE_TABLE");
});

it("compares each source on the route page across every route New project offers", () => {
  const ids = JSON.parse(
    /<RouteComparison ids=\{(\[[^\]]*\])\}/.exec(read("start/choose-a-route.mdx"))![1]!,
  ) as string[];
  const html = renderToStaticMarkup(createElement(RouteComparison, { ids }));
  const headers = [...html.matchAll(/<th(?: [^>]*)?>(.*?)<\/th>/g)].map((match) => match[1]!);
  const vias = ["databricks", "adf-databricks", "adf-synapse", "adf-duckdb", "adf-landing"];
  expect(headers).toHaveLength(1 + vias.length);
  vias.forEach((via, index) => expect(headers[index + 1]).toContain(via));
  const rows = [...html.matchAll(/<tr>(.*?)<\/tr>/g)].map((match) => match[1]!);
  const postgresql = rows.find((row) => row.includes(">PostgreSQL<"));
  expect(postgresql, "a PostgreSQL row").toBeDefined();
  const cells = [...postgresql!.matchAll(/<td>(.*?)<\/td>/g)].map((match) => match[1]!);
  expect(cells).toHaveLength(1 + vias.length);
  const offered = projectRoutes("postgresql").map((route) => route.via);
  expect(offered.length).toBeGreaterThan(0);
  vias.forEach((via, index) =>
    expect(cells[index + 1]!.includes("Not supported"), `postgresql ${via}`).toBe(
      !offered.includes(via),
    ),
  );
});

it("links each platform page once beside a connector: Routes first, then only the pack guides it lacks", () => {
  // sqlserver: Databricks directly lists platforms/databricks under Routes, so
  // the Databricks group does not repeat it. postgresql has no direct route, so
  // its Databricks group keeps the page.
  const links = (id: string) =>
    [...renderToStaticMarkup(createElement(RelatedSetup, { id })).matchAll(/href="([^"]+)"/g)].map(
      (match) => match[1]!,
    );
  const count = (list: string[], href: string) => list.filter((item) => item === href).length;
  const sqlserver = links("sqlserver");
  expect(projectRoutes("sqlserver").map((route) => route.via)).toContain("databricks");
  expect(count(sqlserver, "/docs/platforms/databricks")).toBe(1);
  expect(count(sqlserver, "/docs/platforms/adf")).toBe(1);
  expect(count(sqlserver, "/docs/platforms/adf-pipelines")).toBe(1);
  expect(count(sqlserver, "/docs/how-to/name-things-your-way")).toBe(1);
  const postgresql = links("postgresql");
  expect(projectRoutes("postgresql").map((route) => route.via)).not.toContain("databricks");
  expect(count(postgresql, "/docs/platforms/databricks")).toBe(1);
  expect(count(postgresql, "/docs/platforms/adf")).toBe(1);
  for (const list of [sqlserver, postgresql])
    expect(new Set(list).size, "no page linked twice").toBe(list.length);
});
