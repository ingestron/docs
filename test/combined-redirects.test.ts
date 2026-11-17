// A page that moved to a combined site keeps its old address, which forwards
// there: Load with Data Factory, DuckDB's Deploy through environments, and
// each connector page a platform no longer has, to the page that lists the
// sites that load it.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { projectSources } from "@ingestron/core";
import { describe, expect, it } from "vitest";
import { redirectFor } from "../worker/redirects.js";
import { contentFolder } from "../lib/content-files.js";
import { connectorsFor } from "../lib/reference.js";

const to = (path: string) => redirectFor(new URL(`https://docs.example${path}`));

describe("old addresses on the platform sites", () => {
  it("forward Load with Data Factory to its combination", () => {
    for (const target of ["databricks", "synapse", "duckdb"])
      expect(to(`/docs/${target}/load-with-adf`)).toBe(`/docs/adf-${target}/load-with-adf`);
    expect(to("/docs/duckdb/deploy-through-environments")).toBe("/docs/adf-duckdb/deploy");
  });

  it("forward each connector page a platform lost to the list of its sites, and keep the rest", () => {
    for (const target of ["databricks", "synapse", "duckdb"] as const) {
      const kept = connectorsFor(target);
      for (const { id } of projectSources()) {
        const found = to(`/docs/${target}/connectors/${id}`);
        if (kept.includes(id)) {
          expect(found, `${target}/${id}`).toBeUndefined();
          continue;
        }
        expect(found, `${target}/${id}`).toBe(`/docs/connectors/${id}`);
        expect(existsSync(join(contentFolder, "(moved)/connectors", `${id}.mdx`)), id).toBe(true);
      }
    }
    expect(to("/docs/duckdb/connectors")).toBe("/docs/adf-duckdb/connectors");
  });
});
