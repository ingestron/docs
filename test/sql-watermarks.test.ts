import { expect, it, vi } from "vitest";
import { loadDefinitions } from "@ingestron/definitions";
import { adf } from "@ingestron/pack-adf";
import { databricks } from "@ingestron/pack-databricks";
import { parse } from "yaml";
import { connectorSections, watermarkExample } from "../lib/connector-page.js";
import { exampleFolder, readExampleFile } from "../lib/examples.js";

// The watermark example every adf-copy connector page shows, and what the page says about it.
vi.setConfig({ testTimeout: 30_000 });

it("demonstrates independent table watermarks and matching store ordering in the SQL example", () => {
  const result = loadDefinitions(exampleFolder("private-sql-server"), {
    packs: [databricks, adf],
    environment: "dev",
  });
  expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
  const customers = result.model?.tables.find((table) => table.name === "customers");
  const invoices = result.model?.tables.find((table) => table.name === "invoices");
  expect(customers?.ingest?.settings.watermark_column).toBe("modified_at");
  expect(invoices?.ingest?.settings.watermark_column).toBe("updated_at");
  expect(invoices?.store?.settings.sequence_by).toBe("updated_at");
  expect(invoices?.contract.columns.map((column) => column.name)).toContain("updated_at");
});

it("describes the watermark example as the sample has it, on every adf-copy page", () => {
  const result = loadDefinitions(exampleFolder(watermarkExample), {
    packs: [databricks, adf],
    environment: "dev",
  });
  const table = (name: string) => result.model?.tables.find((item) => item.name === name);
  const customers = table("customers")!;
  const invoices = table("invoices")!;
  const words = connectorSections("sqlserver")
    .flatMap((section) => section.items)
    .flatMap((item) => ("part" in item && item.part.kind === "watermarks" ? item.part.before : []))
    .join(" ");
  // "once an hour", "the same hourly trigger": both tables copy changed rows every hour.
  expect(words).toContain("once an hour");
  expect(words).toContain("The same hourly trigger serves both tables.");
  for (const item of [customers, invoices]) {
    expect(item.ingest?.settings.mode).toBe("incremental");
    expect(item.ingest?.settings.every).toEqual({ frequency: "Hour", interval: 1 });
  }
  // "the standard copies changed rows once an hour, and the flow reads them by `modified_at`".
  const standard = parse(readExampleFile(watermarkExample, "standard.yaml"));
  expect(standard.load.default).toBe("incremental");
  const flow = parse(readExampleFile(watermarkExample, "flows/erp.yaml"));
  expect(flow.load.cursor).toBe("modified_at");
  expect(words).toContain(
    "the flow reads them by `modified_at`. Customers take the flow's cursor.",
  );
  expect(customers.ingest?.settings.watermark_column).toBe("modified_at");
  expect(flow.tables.customers.load).toBeUndefined();
  // "Invoices give their own, `updated_at`, and order their changes by it too."
  expect(flow.tables.invoices.load.cursor).toBe("updated_at");
  expect(flow.tables.invoices.sequence).toBe("updated_at");
  expect(invoices.store?.settings.sequence_by).toBe("updated_at");
  expect(words).toContain(
    "Invoices give their own, `updated_at`, and order their changes by it too.",
  );
});
