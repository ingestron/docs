// The connector picker at the top of a Connectors section's sidebar: type part
// of a name and choose from the connectors that platform loads.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let path = "/docs/synapse/connectors/sqlserver";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

const { ConnectorPicker, connectorMatches } = await import("../components/connector-picker");

const list = [
  { id: "sqlserver", title: "SQL Server" },
  { id: "azure-sql-database", title: "Azure SQL Database" },
  { id: "mysql", title: "MySQL" },
  { id: "rest", title: "REST" },
];

describe("connectorMatches", () => {
  it("finds a connector by any word of its name or by its id, names starting with the query first", () => {
    expect(connectorMatches(list, "sql").map((item) => item.id)).toEqual([
      "sqlserver",
      "azure-sql-database",
      "mysql",
    ]);
    expect(connectorMatches(list, "  REST ").map((item) => item.id)).toEqual(["rest"]);
    expect(connectorMatches(list, "azure-sql").map((item) => item.id)).toEqual([
      "azure-sql-database",
    ]);
    expect(connectorMatches(list, "")).toEqual([]);
    expect(connectorMatches(list, "kafka")).toEqual([]);
  });

  it("lists at most ten", () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      id: `s${index}`,
      title: `Source ${index}`,
    }));
    expect(connectorMatches(many, "source")).toHaveLength(10);
  });
});

describe("ConnectorPicker", () => {
  const lists = { synapse: list, databricks: [], adf: [], duckdb: [] };

  it("shows a labelled search box in a platform's Connectors section", () => {
    path = "/docs/synapse/connectors/sqlserver";
    const html = renderToStaticMarkup(createElement(ConnectorPicker, { lists }));
    expect(html).toContain("Find a connector");
    expect(html).toMatch(/<input[^>]*type="search"/);
    expect(html).toContain('aria-describedby="connector-picker-count"');
  });

  it("shows nothing elsewhere", () => {
    path = "/docs/synapse/deploy";
    expect(renderToStaticMarkup(createElement(ConnectorPicker, { lists }))).toBe("");
    path = "/docs/reference/cli";
    expect(renderToStaticMarkup(createElement(ConnectorPicker, { lists }))).toBe("");
  });
});
