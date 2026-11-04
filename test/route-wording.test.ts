// A connector's page names every route New project offers for it, and no
// destination none of those routes reaches: in its description, its sections,
// its notes and its related setup.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoutes } from "@ingestron/cli";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { parse } from "yaml";
import { ConnectorPage } from "../components/reference/connector-page";
import { RelatedSetup } from "../components/reference/related-setup";
import { connectorEntries, connectorIds } from "../lib/reference.js";

vi.mock("@/components/example", () => ({ Example: () => null }));

// The first page rendered resolves every sample, which takes seconds on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

/** Each destination, by the `--via` values of the routes that end there. */
const destinations: [string, string[]][] = [
  ["Databricks", ["databricks", "adf-databricks"]],
  ["Synapse", ["adf-synapse"]],
  ["DuckDB", ["adf-duckdb"]],
  ["Azure Data Factory", ["adf-databricks", "adf-synapse", "adf-duckdb", "adf-landing"]],
];

/**
 * The page's description, and its text as a reader sees it: the rendered page
 * up to its examples, the connector's notes and the related setup. The
 * examples are left out: they list samples, such as the DuckDB starter that
 * reads files, not routes.
 */
function connectorPage(id: string): { description: string; text: string } {
  const source = readFileSync(join(process.cwd(), "content/docs/connectors", `${id}.mdx`), "utf8");
  const [, front = "", notes = ""] = source.split("---\n");
  const { description } = parse(front) as { description: string };
  const page = renderToStaticMarkup(createElement(ConnectorPage, { id }));
  const html = [
    page.slice(0, page.indexOf('<h2 id="examples"')),
    notes,
    renderToStaticMarkup(createElement(RelatedSetup, { id })),
  ].join(" ");
  // The connector's own name can hold a destination's, such as Azure Synapse Analytics.
  const own = connectorEntries(id).map(({ connector }) => connector.title);
  const strip = (text: string) =>
    own.reduce((rest, title) => rest.replaceAll(title, ""), text.replace(/<[^>]+>/g, " "));
  return {
    description: strip(description),
    text: strip(`${description} ${html}`).replaceAll("&gt;", ">"),
  };
}

for (const id of connectorIds()) {
  it(`${id}: names its routes, and only the destinations they reach`, () => {
    const routes = projectRoutes(id);
    const { description, text } = connectorPage(id);
    for (const route of routes) {
      expect(text, `${id} names "${route.title}"`).toContain(route.title);
      expect(text, `${id} names --via ${route.via}`).toContain(route.via);
    }
    for (const [destination, vias] of destinations) {
      const reached = routes.some((route) => vias.includes(route.via));
      if (!reached) expect(text, `${id} page mentions ${destination}`).not.toContain(destination);
      expect(description.includes(destination), `${id} description and ${destination}`).toBe(
        reached,
      );
    }
    const landing = routes.some((route) => route.via === "adf-landing");
    expect(description.includes("landed files"), `${id} description and adf-landing`).toBe(landing);
  });
}
