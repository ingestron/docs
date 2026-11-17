// Connector pages per platform: each platform's Connectors section holds the
// connectors its routes load, as generated stubs of one shared file each; a
// page shows only that platform's routes, packs and notes; and the old
// /docs/connectors/<id> URL lists the platforms that load the connector.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoutes, projectSources } from "@ingestron/core";
import { describe, expect, it, vi } from "vitest";
import { contentFolder } from "../lib/content-files.js";
import { connectorDescription, connectorSections, connectorSlots } from "../lib/connector-page.js";
import { pageText } from "../lib/platform-text.js";
import { platformById, platformIds, platformPacks } from "../lib/platforms.js";
import { connectorsFor } from "../lib/reference.js";
import { stubFiles } from "../scripts/platform-stubs.js";

// The first page resolves every sample, which takes seconds on a busy machine.
vi.setConfig({ testTimeout: 60_000 });

describe("connectorsFor", () => {
  it("is every source one of the platform's routes loads", () => {
    for (const id of platformIds) {
      const routes = platformById(id).routes;
      const expected = projectSources()
        .map((source) => source.id)
        .filter((source) => projectRoutes(source).some((route) => routes.includes(route.via)));
      expect(connectorsFor(id), id).toEqual(expected);
    }
    expect(connectorsFor("adf")).toContain("sqlserver");
    expect(connectorsFor("databricks")).toContain("files");
    expect(connectorsFor("duckdb")).not.toContain("files");
  });

  it("gives each platform the packs its routes use", () => {
    expect(platformPacks("synapse")).toEqual(["synapse"]);
    expect(platformPacks("adf-synapse")).toEqual(["adf"]);
    expect(platformPacks("adf")).toEqual(["adf"]);
  });
});

describe("a platform's connector page", () => {
  it("shows only that platform's routes and packs", () => {
    const sections = connectorSections("sqlserver", "adf-synapse");
    expect(sections.flatMap((section) => (section.entry ? [section.entry.pack] : []))).toEqual([
      "adf",
      "adf",
    ]);
    const vias = sections.flatMap((section) =>
      section.items.flatMap((item) =>
        "part" in item ? (item.part.routes ?? []).map((route) => route.via) : [],
      ),
    );
    expect(vias.length).toBeGreaterThan(0);
    for (const via of vias) expect(platformById("adf-synapse").routes).toContain(via);
    expect(connectorSlots("sqlserver", "adf-synapse")).not.toContain("databricks-reading");
    expect(connectorSlots("sqlserver", "databricks")).toContain("databricks-reading");
  });

  it("drops the notes for packs the platform does not use", () => {
    const synapse = pageText(join(contentFolder, "adf-synapse/connectors/sqlserver.mdx"));
    expect(synapse).not.toContain('<ConnectorNote at="databricks-');
    expect(synapse).toContain('platform="adf-synapse"');
    const databricks = pageText(join(contentFolder, "databricks/connectors/sqlserver.mdx"));
    expect(databricks).toContain('<ConnectorNote at="databricks-');
  });

  it("is described for that platform, from the route facts", () => {
    const text = connectorDescription("sqlserver", "adf-synapse");
    expect(text).toMatch(/SQL Server/);
    expect(text).toMatch(/Synapse/);
    expect(text).not.toMatch(/Databricks|DuckDB/);
    expect(connectorDescription("sqlserver", "databricks")).toMatch(/Lakeflow Connect/);
    expect(connectorDescription("sqlserver", "databricks")).toMatch(/\.$/);
  });
});

describe("the generated connector stubs", () => {
  it("are on disk exactly as scripts/platform-stubs.ts writes them", () => {
    const expected = stubFiles();
    for (const [path, text] of expected)
      expect(
        existsSync(join(contentFolder, path)) && readFileSync(join(contentFolder, path), "utf8"),
        path,
      ).toBe(text);
    for (const id of platformIds) {
      const folder = join(contentFolder, id, "connectors");
      // A site that loads no source has no Connectors folder.
      if (connectorsFor(id).length === 0) {
        expect(existsSync(folder), id).toBe(false);
        continue;
      }
      const files = readdirSync(folder).map((file) => `${id}/connectors/${file}`);
      expect(files.sort(), id).toEqual(
        [...expected.keys()].filter((path) => path.startsWith(`${id}/connectors/`)).sort(),
      );
      expect(files, id).toContain(`${id}/connectors/index.mdx`);
      expect(files.length, id).toBe(connectorsFor(id).length + 2); // index.mdx and meta.json
    }
  });

  it("keep each old connector URL as a page listing the platforms that load it", () => {
    for (const source of projectSources()) {
      const file = join(contentFolder, "(moved)/connectors", `${source.id}.mdx`);
      expect(readFileSync(file, "utf8"), source.id).toContain(
        `<ConnectorChooser id="${source.id}" />`,
      );
    }
    expect(readFileSync(join(contentFolder, "(moved)/connectors/index.mdx"), "utf8")).toContain(
      "<ConnectorChooser />",
    );
  });
});

describe("the watermark example on a connector page", () => {
  it("is the site's own: the starter on its combination, Data Factory alone elsewhere", () => {
    const shown = (on: "adf" | "adf-synapse" | "adf-duckdb" | "adf-databricks") =>
      connectorSections("sqlserver", on)
        .flatMap((section) => section.items)
        .flatMap((item) =>
          "part" in item && item.part.kind === "watermarks" ? [item.part] : [],
        )[0]!;
    expect(shown("adf-databricks").example).toBe("private-sql-server");
    for (const on of ["adf", "adf-synapse", "adf-duckdb"] as const) {
      expect(shown(on).example, on).toBe("adf-private-sql-server");
      expect(shown(on).before.join(" "), on).not.toMatch(/Databricks/);
    }
  });
});
