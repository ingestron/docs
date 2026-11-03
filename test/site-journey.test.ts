import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoutes } from "@ingestron/cli";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RouteComparison } from "../components/reference/route-comparison";

const read = (path: string) => readFileSync(join(process.cwd(), "content/docs", path), "utf8");

it("offers one learning path and one guide collection with discoverable landing pages", () => {
  const root = JSON.parse(read("meta.json"));
  expect(root.pages).not.toContain("tutorials");
  for (const section of ["start", "concepts", "how-to", "examples", "tools", "reference"]) {
    expect(root.pages).toContain(section);
    expect(JSON.parse(read(`${section}/meta.json`)).pages).toContain("index");
    expect(read(`${section}/index.mdx`)).toContain("<DocLinks");
  }
});

it("makes YAML reference syntax reachable from the introduction and concepts", () => {
  expect(read("index.mdx")).toContain("/docs/concepts/yaml-references");
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
  expect(routes).toContain("ADF, ending at the landed files (`adf-landing`)");
  expect(routes).toContain("/docs/how-to/run-locally-with-duckdb");
  expect(routes).toContain("will not enable a destination no pack");
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
