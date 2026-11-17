// Each platform's copy of a connector's page names every route that platform
// offers for it, and no destination none of those routes, or the built-in
// starters that read it there, reaches: in its description, its sections, its
// notes and its related setup.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoutes } from "@ingestron/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ConnectorPage } from "../components/reference/connector-page";
import { RelatedSetup } from "../components/reference/related-setup";
import { listExamples } from "../lib/examples.js";
import { sharedFolder } from "../lib/content-files.js";
import { connectorDescription } from "../lib/connector-page.js";
import { onlyFor } from "../lib/platform-text.js";
import { platforms, type Platform } from "../lib/platforms.js";
import {
  connectorEntries,
  connectorIds,
  connectorsFor,
  platformUsedPacks,
} from "../lib/reference.js";

vi.mock("@/components/example", () => ({ Example: () => null }));

// The first page rendered resolves every sample, which takes seconds on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

/** Each destination, by the `--via` values of the routes that end there. */
const destinations: [string, string[]][] = [
  ["Databricks", ["databricks", "adf-databricks"]],
  ["Synapse", ["synapse", "adf-synapse"]],
  ["DuckDB", ["adf-duckdb"]],
  ["Azure Data Factory", ["adf-databricks", "adf-synapse", "adf-duckdb", "adf-landing"]],
];

/** Each destination, by the pack a starter uses to reach it. */
const packDestinations: Record<string, string> = {
  databricks: "Databricks",
  synapse: "Synapse",
  duckdb: "DuckDB",
  adf: "Azure Data Factory",
};

/** Where a source's own name holds a destination's: the words that name the source, not the destination. */
const sourceNames: Record<string, string[]> = {
  "azure-databricks-delta": [
    "AzureDatabricksDeltaLake",
    "Databricks Delta",
    "Databricks workspace",
  ],
  snowflake: ["Snowflake or Databricks Delta"],
};

/** The destinations the built-in starters that read the connector reach on a platform, by their packs. */
const starterDestinations = (id: string, platform: Platform["id"]) => {
  const used = platformUsedPacks(platform);
  return listExamples()
    .filter((example) => example.template && example.facts.connectors.includes(id))
    .filter((example) => example.facts.packs.every((pack) => used.has(pack)))
    .flatMap((example) => example.facts.packs.map((pack) => packDestinations[pack]));
};

/**
 * A platform's copy of the page: its description, and its text as a reader
 * sees it: the rendered page up to its examples, the notes that platform
 * shows and the related setup. The examples are left out: they list samples,
 * such as the DuckDB starter that reads files, not routes.
 */
function connectorPage(
  id: string,
  platform: Platform["id"],
): { description: string; text: string } {
  const source = readFileSync(join(sharedFolder, "connectors", `${id}.mdx`), "utf8");
  const notes = onlyFor(source, platform);
  const description = connectorDescription(id, platform);
  const page = renderToStaticMarkup(createElement(ConnectorPage, { id, platform }));
  const html = [
    page.slice(0, page.indexOf('<h2 id="examples"')),
    notes,
    renderToStaticMarkup(createElement(RelatedSetup, { id, platform })),
  ].join(" ");
  // The connector's own name can hold a destination's, such as Azure Synapse Analytics,
  // and so can the source it reads: Databricks Delta tables are a source too.
  const own = [
    ...(sourceNames[id] ?? []),
    ...connectorEntries(id).map(({ connector }) => connector.title),
  ];
  // A label that says an example comes from another platform names it on purpose.
  const label = /(?:This|The) example is a Databricks project[^.]*\./g;
  const strip = (text: string) =>
    own.reduce(
      (rest, title) => rest.replaceAll(title, ""),
      text
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .replace(label, ""),
    );
  return {
    description: strip(description),
    text: strip(`${description} ${html}`).replaceAll("&gt;", ">"),
  };
}

for (const id of connectorIds())
  for (const platform of platforms.filter((item) => connectorsFor(item.id).includes(id)))
    it(`${platform.id}/${id}: names its routes there, and only the destinations they reach`, () => {
      const routes = projectRoutes(id).filter((route) => platform.routes.includes(route.via));
      const { description, text } = connectorPage(id, platform.id);
      for (const route of routes) {
        expect(text, `${id} names "${route.title}"`).toContain(route.title);
        expect(text, `${id} names --via ${route.via}`).toContain(route.via);
      }
      for (const [destination, vias] of destinations) {
        const byRoute = routes.some((route) => vias.includes(route.via));
        const reached = byRoute || starterDestinations(id, platform.id).includes(destination);
        if (!reached)
          expect(text, `${platform.id}/${id} mentions ${destination}`).not.toContain(destination);
        expect(
          description.includes(destination),
          `${platform.id}/${id} description and ${destination}`,
        ).toBe(byRoute);
      }
    });
