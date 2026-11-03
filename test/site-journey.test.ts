import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoutes } from "@ingestron/cli";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RouteComparison } from "../components/reference/route-comparison";
import { RouteTable } from "../components/reference/route-table";
import { allRoutes } from "../lib/reference";

const read = (path: string) => readFileSync(join(process.cwd(), "content/docs", path), "utf8");

it("opens with one learning path, then one guide collection with discoverable landing pages", () => {
  const root = JSON.parse(read("meta.json"));
  expect(root.pages).not.toContain("tutorials");
  // Get started is a separator with its pages in reading order, not an index page of links.
  expect(root.pages.slice(0, 3)).toEqual(["index", "---Get started---", "...start"]);
  expect(JSON.parse(read("start/meta.json")).pages).toEqual([
    "first-project",
    "how-it-works",
    "choose-a-route",
    "install",
  ]);
  expect(existsSync(join(process.cwd(), "content/docs/start/index.mdx"))).toBe(false);
  for (const section of ["concepts", "how-to", "examples", "tools", "reference"]) {
    expect(root.pages).toContain(section);
    expect(JSON.parse(read(`${section}/meta.json`)).pages).toContain("index");
    expect(read(`${section}/index.mdx`)).toContain("<DocLinks");
  }
});

it("links the three next steps from the home page, one for each kind of reader", () => {
  const next = read("index.mdx").split("\n## Next\n")[1];
  expect(next, "a Next section").toBeDefined();
  for (const [reader, links] of [
    ["Data engineers", ["/docs/start/first-project"]],
    ["Platform teams", ["/docs/how-to/configure-a-standard", "/docs/how-to/ask-the-platform-team"]],
    ["Comparing routes", ["/docs/start/choose-a-route"]],
  ] as const) {
    const line = next!.split("\n- ").find((item) => item.includes(`**${reader}:**`));
    expect(line, reader).toBeDefined();
    for (const link of links) expect(line, `${reader} → ${link}`).toContain(`(${link})`);
  }
});

it("runs the first project with no cloud account, source or deployment", () => {
  const first = read("start/first-project.mdx");
  expect(first).toContain("No cloud account");
  expect(first).toContain('<Example name="duckdb" file="build/dev/run.sql" />');
  const commands = [...first.matchAll(/^```sh\n([\s\S]*?)^```$/gm)].flatMap((match) =>
    match[1]!.trimEnd().split("\n"),
  );
  expect(commands.length).toBeGreaterThan(0);
  // Only Ingestron, DuckDB and the shell: no cloud command line, nothing deployed.
  for (const command of commands)
    expect(command).toMatch(/^(npx ingestron@1 |cd |duckdb |rm build\/|ls published$)/);
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
  const layout = readFileSync(join(process.cwd(), "app/docs/layout.tsx"), "utf8");
  expect(layout).toContain('href="/docs/concepts/yaml-references"');
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
  expect(routes).toContain("will not enable a destination no pack");
  const html = renderToStaticMarkup(createElement(RouteTable, { detail: true }));
  const rows = [...html.matchAll(/<tr>(.*?)<\/tr>/g)].map((match) => match[1]!).slice(1);
  // The starter, then every route New project offers, each with its guide.
  expect(rows).toHaveLength(1 + allRoutes().length);
  expect(rows[0]).toContain("<code>--template duckdb</code>");
  expect(rows[0]).toContain('href="/docs/how-to/run-locally-with-duckdb"');
  allRoutes().forEach(({ via, title }, index) => {
    expect(rows[index + 1]).toContain(title);
    expect(rows[index + 1]).toContain(`<code>--via ${via}</code>`);
    expect(rows[index + 1]).toMatch(/href="\/docs\/how-to\/[a-z-]+"/);
  });
  expect(html).toContain("ADF ingestion, ending at the landed files");
  expect(html).toContain('href="/docs/how-to/run-duckdb-in-azure"');
  expect(read("index.mdx")).toContain("<RouteTable />");
  const packs = read("reference/packs/index.mdx");
  expect(packs).toContain("ADF landing only");
  expect(packs).toContain("/docs/how-to/run-duckdb-in-azure");
  expect(read("how-to/run-duckdb-in-azure.mdx")).toContain("ghcr.io/ingestron/duckdb-runner:1");
  expect(read("how-to/plan-and-generate.mdx")).toContain("does not deploy");
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
