// Each platform's site holds only that platform's own routes; Data Factory
// into a target is a combined site of its own, listed after the platforms.
// specs/2026-11-16-docs-combined-sites-design.md in the dev repository.
import { describe, expect, it } from "vitest";
import { platformById, platforms, sectionsOf } from "../lib/platforms.js";
import { connectorsFor } from "../lib/reference.js";

describe("the sites", () => {
  it("are the four platforms, then the three combinations", () => {
    expect(platforms.map(({ id, kind }) => `${kind}:${id}`)).toEqual([
      "platform:synapse",
      "platform:databricks",
      "platform:adf",
      "platform:duckdb",
      "combined:adf-databricks",
      "combined:adf-synapse",
      "combined:adf-duckdb",
    ]);
  });

  it("give each platform only its own route", () => {
    expect(platformById("synapse").routes).toEqual(["synapse"]);
    expect(platformById("databricks").routes).toEqual(["databricks"]);
    expect(platformById("adf").routes).toEqual(["adf-landing"]);
    expect(platformById("duckdb").routes).toEqual(["duckdb"]);
  });

  it("name each combination for its two platforms, in the order the data goes", () => {
    for (const [id, title, parts] of [
      ["adf-databricks", "Data Factory into Databricks", ["adf", "databricks"]],
      ["adf-synapse", "Data Factory into Synapse", ["adf", "synapse"]],
      ["adf-duckdb", "Data Factory into DuckDB", ["adf", "duckdb"]],
    ] as const) {
      const site = platformById(id);
      expect(site.title).toBe(title);
      expect(site.routes).toEqual([id]);
      expect(site.parts).toEqual(parts);
    }
  });

  it("list the connectors each site's route reads, and no Connectors tab where there are none", () => {
    expect(Object.fromEntries(platforms.map(({ id }) => [id, connectorsFor(id).length]))).toEqual({
      synapse: 1,
      databricks: 4,
      adf: 76,
      duckdb: 0,
      "adf-databricks": 76,
      "adf-synapse": 63,
      "adf-duckdb": 64,
    });
    expect(connectorsFor("databricks").sort()).toEqual([
      "files",
      "kafka",
      "salesforce",
      "sqlserver",
    ]);
    expect(sectionsOf("duckdb")).not.toContain("connectors");
    expect(sectionsOf("databricks")).toContain("connectors");
    for (const id of ["adf-databricks", "adf-synapse", "adf-duckdb"] as const)
      expect(sectionsOf(id), id).toEqual(["start", "guides", "connectors"]);
  });
});
