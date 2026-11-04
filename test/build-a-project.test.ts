// The "Build a project" guides, run as they show them: each command is read
// from the page and run in a copy of the sample the page names, each output
// block is compared with what the command prints, and each hand-written YAML
// fragment, which no sample holds, is merged into a sample and generated.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ContractTypes } from "../components/reference/contract-types";
import { packs, settingRows } from "../lib/reference";
import { cli, command, commands, copy, fences, merge, read, section } from "./pages.js";

/** The first project's `shop`, created with the tutorial's own command and applied. */
function shop(): string {
  const create = commands(section(read("start/first-project.mdx"), "## 1. Create the project"));
  const init = create.find((line) => line.startsWith("npx ingestron@1 init "))!;
  const parent = mkdtempSync(join(tmpdir(), "docs-build-shop-"));
  expect(cli(parent, init.split(" ").slice(2)).code).toBe(0);
  const cwd = join(parent, create.find((line) => line.startsWith("cd "))!.slice("cd ".length));
  expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
  return cwd;
}

/** The values a method's setting accepts, from the pack's own schema. */
function accepted(pack: string, method: string, setting: string): unknown[] {
  const row = settingRows(pack, method).find((field) => field.path.join(".") === setting);
  return (row?.values ?? []).map((item) => item.value);
}

describe("how-to/add-a-source", () => {
  const page = read("how-to/add-a-source.mdx");

  it("adds a customers table to the first project, with the contract and plan it shows", () => {
    const steps = section(page, "## Add a table from a source you already read");
    const cwd = shop();
    writeFileSync(join(cwd, "samples/customers.csv"), fences(steps, "csv")[0]!);
    const [drafted, planned] = fences(steps, "text");

    const contract = cli(cwd, command(commands(steps), "contract"));
    expect(contract.code).toBe(0);
    expect(contract.output.trim()).toBe(drafted!.trim());

    // The line the page adds under the flow's `tables`.
    merge(join(cwd, "flows/orders.yaml"), `tables:\n${fences(steps, "yaml")[0]!}`);
    const flow = parse(readFileSync(join(cwd, "flows/orders.yaml"), "utf8"));
    expect(Object.keys(flow.tables)).toEqual(["orders", "customers"]);

    const plan = cli(cwd, command(commands(steps), "plan"));
    expect(plan.code).toBe(0);
    expect(plan.output.trim()).toBe(planned!.trim());
  });

  it("names the pack that can read a source the project's packs cannot", () => {
    const steps = section(page, "## Add another source");
    const cwd = shop();
    writeFileSync(
      join(cwd, "connections/crm.yaml"),
      [
        "apiVersion: ingestron.io/v1",
        "kind: Connection",
        "id: crm",
        "connector: postgresql",
        "connectivity: private",
        "settings: { server: crm.example.test, database: crm }",
        "",
      ].join("\n"),
    );
    // `source` on line 4, as the page's problem says.
    writeFileSync(
      join(cwd, "flows/crm.yaml"),
      [
        "apiVersion: ingestron.io/v1",
        "kind: Flow",
        "id: crm",
        "source: crm",
        "tables:",
        "  accounts: { object: public.accounts, contract: shop.orders }",
        "",
      ].join("\n"),
    );
    const plan = cli(cwd, ["plan", "--no-diff"]);
    expect(plan.code).toBe(1);
    expect(plan.output.trim()).toBe(fences(steps, "text")[0]!.trim());
  });
});

describe("how-to/keep-a-table-current", () => {
  const page = read("how-to/keep-a-table-current.mdx");

  it("upserts the starter's orders with the page's fragment", () => {
    const cwd = shop();
    const before = readFileSync(join(cwd, "build/dev/tables/bronze.orders.sql"), "utf8");
    expect(before).toContain('CREATE OR REPLACE TABLE "bronze"."orders" AS');
    merge(join(cwd, "flows/orders.yaml"), fences(section(page, "## On DuckDB"), "yaml")[0]!);
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
    const after = readFileSync(join(cwd, "build/dev/tables/bronze.orders.sql"), "utf8");
    expect(after).toContain('INSERT OR REPLACE INTO "bronze"."orders"');
    expect(after).toContain('ORDER BY "ordered_at" DESC, "_ingestron_file" DESC');
  });

  it("compares the modes each engine's store method accepts", () => {
    const table = page.split("\n## ")[0]!;
    const row = (engine: string) =>
      table
        .split("\n")
        .find((line) => line.startsWith(`| ${engine} `))!
        .split("|")
        .slice(2, -1)
        .map((cell) => cell.trim());
    const duckdb = accepted("duckdb", "duckdb-table", "mode");
    expect(row("DuckDB")).toEqual(["`upsert`", "No", "No"]);
    expect(duckdb).toContain("upsert");
    expect(duckdb).not.toContain("history");
    expect(
      settingRows("duckdb", "duckdb-table").map((field) => field.path.join(".")),
    ).not.toContain("delete_when");
    const databricks = accepted("databricks", "streaming-table", "mode");
    expect(row("Databricks")).toEqual(["`upsert`", "`history`", "`delete_when`"]);
    expect(databricks).toEqual(expect.arrayContaining(["upsert", "history"]));
    expect(
      settingRows("databricks", "streaming-table").map((field) => field.path.join(".")),
    ).toContain("delete_when");
    // A Synapse view has no mode at all.
    expect(row("Synapse")).toEqual(["No", "No", "No"]);
    expect(
      settingRows("synapse", "synapse-view").map((field) => field.path.join(".")),
    ).not.toContain("mode");
  });
});

describe("how-to/add-an-environment", () => {
  const page = read("how-to/add-an-environment.mdx");

  it("prints the comparison the page shows, and the production defaults it names", () => {
    const differs = section(page, "## Check what differs");
    const cwd = copy("environments");
    const compared = cli(cwd, command(commands(differs), "compare"));
    expect(compared.code).toBe(0);
    expect(compared.output.trim()).toBe(fences(differs, "text")[0]!.trim());
    const prod = cli(cwd, ["compare", "--env", "dev", "--env", "prod"]).output;
    for (const key of ["mode", "schedule.paused"]) expect(prod).toContain(`- \`${key}\`:`);
  });
});

describe("how-to/write-a-contract", () => {
  const page = read("how-to/write-a-contract.mdx");

  it("shows each pack's type for a logical type, from the packs", () => {
    expect(page).toContain("<ContractTypes />");
    const html = renderToStaticMarkup(createElement(ContractTypes));
    for (const pack of packs) {
      for (const type of Object.values(pack.defaults.types ?? {}))
        expect(html, `${pack.id} ${type}`).toContain(`<code>${type}</code>`);
    }
    // ADF types no tables, and the page says why it has no column.
    expect(Object.keys(packs.find((pack) => pack.id === "adf")!.defaults.types ?? {})).toEqual([]);
    expect(html).not.toContain("Azure Data Factory");
  });

  it("keeps the draft-from-a-sample heading the old URL redirects to", () => {
    expect(page).toContain("## Draft from a sample [#draft-from-a-sample]");
    expect(command(commands(section(page, "## Draft from a sample")), "contract")).toEqual([
      "contract",
      "exports/orders.csv",
      "--name",
      "shop.orders",
    ]);
  });
});

it("keeps the old pages' anchors on the pages they merged into", () => {
  expect(read("how-to/start-from-a-template.mdx")).toContain(
    "## Start from a starter [#start-from-a-starter]",
  );
});
