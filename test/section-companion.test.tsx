// Concepts and Reference join the product-wide pages with each platform's
// own. A platform's concept or reference page lists the product-wide pages
// above its sidebar; a product-wide page lists the remembered platform's own.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { companionData } from "../lib/areas.js";
import { searchBreadcrumbs } from "../lib/search-breadcrumbs.js";
import { tree } from "./tree.js";

let path = "/docs/synapse/not-applied";
vi.mock("next/navigation", () => ({ usePathname: () => path }));
const { SectionCompanion, companionFor } = await import("../components/section-companion");

const data = companionData(tree);

describe("companionFor", () => {
  it("on a platform's own concept page, lists the product-wide concepts", () => {
    const found = companionFor("/docs/synapse/not-applied", undefined, data)!;
    expect(found.heading).toBe("For every platform");
    expect(found.links.map((link) => link.url)).toContain("/docs/concepts/definitions");
  });

  it("on a product-wide page, lists the remembered platform's own pages there", () => {
    const found = companionFor("/docs/reference/cli", "duckdb", data)!;
    expect(found.heading).toBe("On DuckDB");
    expect(found.links.map((link) => link.url)).toEqual([
      "/docs/duckdb/troubleshooting",
      "/docs/reference/packs/duckdb",
    ]);
    expect(
      companionFor("/docs/concepts/layers", "adf", data)!.links.map((link) => link.url),
    ).toEqual(["/docs/adf/environments-and-platform", "/docs/adf/not-applied"]);
  });

  it("is nothing elsewhere, or with no platform remembered", () => {
    expect(companionFor("/docs/reference/cli", undefined, data)).toBeUndefined();
    expect(companionFor("/docs/synapse/deploy", "synapse", data)).toBeUndefined();
  });
});

describe("SectionCompanion", () => {
  it("renders the product-wide links on a platform's own page from the first paint", () => {
    path = "/docs/databricks/troubleshooting";
    const html = renderToStaticMarkup(createElement(SectionCompanion, { data }));
    expect(html).toContain("For every platform");
    expect(html).toContain('href="/docs/reference/cli"');
    expect(html).toContain('class="section-companion"');
  });
});

describe("search breadcrumbs", () => {
  it("start with the platform and its section, so the copies of a shared page differ", () => {
    expect(searchBreadcrumbs("/docs/synapse/write-a-contract", tree)).toEqual([
      "Azure Synapse",
      "Guides",
    ]);
    expect(searchBreadcrumbs("/docs/adf-duckdb/connectors/sqlserver", tree)).toEqual([
      "Data Factory into DuckDB",
      "Connectors",
    ]);
    expect(searchBreadcrumbs("/docs/reference/cli", tree)).toBeUndefined();
  });
});

describe("the platform's Reference group", () => {
  it("links the packs the platform uses", () => {
    const synapse = data.reference.platforms.synapse!.map((link) => link.url);
    expect(synapse).toContain("/docs/reference/packs/synapse");
    // A platform's own packs only: a combination's are on its own site.
    expect(synapse).not.toContain("/docs/reference/packs/adf");
    expect(synapse).not.toContain("/docs/reference/packs/databricks");
    expect(data.reference.platforms.adf!.map((link) => link.url)).toContain(
      "/docs/reference/packs/adf",
    );
  });
});
