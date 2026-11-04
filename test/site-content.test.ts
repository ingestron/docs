// Example downloads, connector facts, search and the error reference.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { exampleFiles, exampleFolder } from "../lib/examples.js";
import { connectorEntries } from "../lib/reference.js";
import { extraStructure } from "../lib/search.js";

// Connector search entries resolve every sample the first time, which takes seconds on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

describe("example downloads", () => {
  it("hold the definitions, not generated output", () => {
    const generated = join(exampleFolder("environments"), "build");
    mkdirSync(generated, { recursive: true });
    writeFileSync(join(generated, "stray.sql"), "generated");
    try {
      const files = exampleFiles("environments");
      expect(files).toContain("project.yaml");
      expect(files.filter((file) => file.startsWith("build/"))).toEqual([]);
    } finally {
      rmSync(generated, { recursive: true, force: true });
    }
  });
});

describe("connector facts", () => {
  it("show the connectivity each method supports", () => {
    expect(connectorEntries("sqlserver").map((entry) => entry.connectivity)).toEqual([
      ["public", "workspace"],
      ["private", "workspace", "public"],
    ]);
  });
});

describe("search", () => {
  const text = (url: string) => JSON.stringify(extraStructure(url));

  it("finds every error code on the errors page", () => {
    expect(text("/docs/reference/errors")).toContain("CONTRACT_TABLE");
    expect(text("/docs/reference/errors")).toContain("UNKNOWN_INPUT");
  });

  it("finds method settings on the packs page", () => {
    expect(text("/docs/reference/packs/adf")).toContain("watermark_column");
  });

  it("indexes native connection fields on the connector's page, under its ADF fields", () => {
    expect(text("/docs/connectors/snowflake")).toContain('"adf-connection-private_key"');
    expect(text("/docs/connectors/snowflake")).toContain("private_key");
    expect(text("/docs/connectors/rest")).toContain('"adf-connection-auth_headers"');
    expect(text("/docs/connectors/rest")).toContain("auth_headers");
  });

  it("indexes the catalogue's categories", () => {
    expect(text("/docs/connectors")).toContain('"databases-and-analytics"');
    expect(text("/docs/connectors")).toContain("SQL Server");
  });

  it("adds nothing to other pages", () => {
    expect(extraStructure("/docs")).toEqual({ headings: [], contents: [] });
  });
});
