// The "Build a project" guides, run as they show them: each command is read
// from the page and run in a copy of the sample the page names, each output
// block is compared with what the command prints, and each hand-written YAML
// fragment, which no sample holds, is merged into a sample and generated.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@ingestron/cli";
import { intentUseOf } from "@ingestron/definitions";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { ContractTypes } from "../components/reference/contract-types";
import { packName, packs, settingRows } from "../lib/reference";
import { cli, command, commands, copy, fences, merge, read, section } from "./pages.js";

/** The first project's `shop`, created with the tutorial's own command and applied. */
function shop(): string {
  const create = commands(section(read("start/first-project.mdx"), "## 1. Create the project"));
  const init = create.find((line) => line.startsWith("ingestron init "))!;
  const parent = mkdtempSync(join(tmpdir(), "docs-build-shop-"));
  expect(cli(parent, init.split(" ").slice(1)).code).toBe(0);
  const cwd = join(parent, create.find((line) => line.startsWith("cd "))!.slice("cd ".length));
  expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
  return cwd;
}

/** Prose with its line breaks as spaces, to find a sentence wherever the page wraps it. */
const prose = (text: string) => text.replace(/\s+/g, " ");

/** A sample's project id, which names its Databricks output folder. */
const projectId = (cwd: string) =>
  parse(readFileSync(join(cwd, "project.yaml"), "utf8")).id as string;

/** Gives one contract column another logical type. */
function retype(file: string, column: string, from: string, to: string): void {
  const text = readFileSync(file, "utf8");
  const before = `{ name: ${column}, logicalType: ${from}`;
  expect(text, `${file} has ${before}`).toContain(before);
  writeFileSync(file, text.replace(before, `{ name: ${column}, logicalType: ${to}`));
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
    // The key the page marks in the drafted contract.
    expect(prose(steps)).toContain(
      "mark `customer_id` with `primaryKey: true` and `required: true`",
    );
    const contractFile = join(cwd, "contracts/shop.customers.yaml");
    const key = "{ name: customer_id, logicalType: integer }";
    expect(readFileSync(contractFile, "utf8")).toContain(key);
    writeFileSync(
      contractFile,
      readFileSync(contractFile, "utf8").replace(
        key,
        "{ name: customer_id, logicalType: integer, primaryKey: true, required: true }",
      ),
    );

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

describe("how-to/write-a-transform", () => {
  it("builds a silver copy of the first project's orders from a transform with no code", () => {
    const steps = section(
      read("how-to/write-a-transform.mdx"),
      "## Leave out the code [#without-code]",
    );
    expect(prose(steps)).toContain("saved as `transforms/orders_clean.yaml`");
    const cwd = shop();
    writeFileSync(join(cwd, "transforms/orders_clean.yaml"), fences(steps, "yaml")[0]!);
    const plan = cli(cwd, ["plan", "--no-diff"]);
    expect(plan.code, plan.output).toBe(0);
    expect(plan.output).toMatch(/^create +dev\/tables\/silver\.orders_clean\.sql$/m);
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
    const sql = readFileSync(join(cwd, "build/duckdb/dev/tables/silver.orders_clean.sql"), "utf8");
    expect(sql).toContain(`nullif(trim(CAST("customer" AS VARCHAR)), '') AS "customer"`);
    expect(sql).toContain(`SELECT * FROM "bronze"."orders"`);
  });
});

describe("how-to/keep-a-table-current", () => {
  const page = read("how-to/keep-a-table-current.mdx");

  it("upserts the starter's orders with the page's fragment", () => {
    const cwd = shop();
    const before = readFileSync(join(cwd, "build/duckdb/dev/tables/bronze.orders.sql"), "utf8");
    expect(before).toContain('CREATE OR REPLACE TABLE "bronze"."orders" AS');
    merge(join(cwd, "flows/orders.yaml"), fences(section(page, "## On DuckDB"), "yaml")[0]!);
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
    const after = readFileSync(join(cwd, "build/duckdb/dev/tables/bronze.orders.sql"), "utf8");
    expect(after).toContain('INSERT OR REPLACE INTO "bronze"."orders"');
    expect(after).toContain('ORDER BY "ordered_at" DESC, "_ingestron_file" DESC');
  });

  it("compares what each engine does with the intent, from the packs' own coverage", () => {
    const table = page.split("\n## ")[0]!;
    expect(table).toContain("<IntentOverview");
    // DuckDB keeps the latest row but not every version; Databricks both, and deletes.
    const used = (pack: string, path: string, value?: string) =>
      intentUseOf(
        packs.find((item) => item.id === pack)!,
        path,
        value,
      )?.use;
    expect(used("duckdb", "history", "latest")).toBe("used");
    expect(used("duckdb", "history", "full")).not.toBe("used");
    expect(used("databricks", "history", "full")).toBe("used");
    expect(used("databricks", "load.deletes.when")).toBe("used");
    expect(used("synapse", "history", "latest")).toBe("not-applicable");
    // The settings each intent stands for, which the page names.
    expect(accepted("duckdb", "duckdb-table", "mode")).toContain("upsert");
    expect(page).toContain("`mode: upsert`");
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

  it("shows each pack's type for a logical type, in that type's row and that pack's column", () => {
    expect(page).toContain("<ContractTypes />");
    const html = renderToStaticMarkup(createElement(ContractTypes));
    const cells = (row: string) =>
      [...row.matchAll(/<t[hd]>(.*?)<\/t[hd]>/g)].map((match) => match[1]!);
    const [header, ...rows] = [...html.matchAll(/<tr>(.*?)<\/tr>/g)].map((match) =>
      cells(match[1]!),
    );
    const typed = packs.filter((pack) => Object.keys(pack.defaults.types ?? {}).length > 0);
    expect(header!.slice(1)).toEqual(typed.map((pack) => packName(pack.id)));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const logical = /^<code>(.*)<\/code>$/.exec(row[0]!)![1]!;
      typed.forEach((pack, index) => {
        const found = pack.defaults.types?.[logical];
        expect(row[index + 1], `${pack.id} ${logical}`).toBe(
          found ? `<code>${found}</code>` : "no default",
        );
      });
    }
    // Every type a pack gives has a row.
    for (const pack of typed)
      for (const logical of Object.keys(pack.defaults.types ?? {}))
        expect(
          rows.some((row) => row[0] === `<code>${logical}</code>`),
          `${pack.id} ${logical}`,
        ).toBe(true);
    // ADF types no tables, and the page says why it has no column.
    expect(Object.keys(packs.find((pack) => pack.id === "adf")!.defaults.types ?? {})).toEqual([]);
  });

  it("leaves a column with no default type to the platform on Databricks, and VARCHAR on DuckDB", () => {
    expect(prose(page)).toContain(
      "Databricks then leaves the column out of the types it declares, so the platform decides; DuckDB reads it as `VARCHAR`.",
    );
    const databricks = copy("minimal");
    retype(join(databricks, "contracts/orders.yaml"), "customer_id", "integer", "object");
    const out = join(databricks, "out");
    expect(cli(databricks, ["apply", "--no-diff", "--out", out]).code).toBe(0);
    const bronze = readFileSync(
      join(out, "databricks/src", projectId(databricks), "bronze/orders.sql"),
      "utf8",
    );
    expect(bronze).toContain(
      "schemaHints => '`id` BIGINT, `total` DECIMAL(18,2), `ordered_at` TIMESTAMP'",
    );

    const duckdb = copy("duckdb");
    retype(join(duckdb, "contracts/orders.yaml"), "customer", "string", "object");
    expect(cli(duckdb, ["apply", "--no-diff", "--out", join(duckdb, "out")]).code).toBe(0);
    expect(readFileSync(join(duckdb, "out/duckdb/dev/tables/bronze.orders.sql"), "utf8")).toContain(
      'CAST("customer" AS VARCHAR)',
    );
  });

  it("checks rows by a column's logicalTypeOptions, and unique once checks are on", () => {
    const text = prose(section(page, "## Rules about the data"));
    expect(text).toContain("such as `customer_id_minimum`");
    expect(text).toContain("when the platform turns on `databricks.manage.checks`");
    const cwd = copy("minimal");
    const contract = join(cwd, "contracts/orders.yaml");
    writeFileSync(
      contract,
      readFileSync(contract, "utf8").replace(
        "{ name: customer_id, logicalType: integer }",
        "{ name: customer_id, logicalType: integer, unique: true, logicalTypeOptions: { minimum: 1 } }",
      ),
    );
    const out = join(cwd, "out");
    const id = projectId(cwd);
    expect(cli(cwd, ["apply", "--no-diff", "--out", out]).code).toBe(0);
    const bronze = readFileSync(join(out, "databricks/src", id, "bronze/orders.sql"), "utf8");
    expect(bronze).toContain(
      "CONSTRAINT `customer_id_minimum` EXPECT (`customer_id` IS NULL OR `customer_id` >= 1)",
    );
    expect(bronze).not.toContain("customer_id_unique");
    // With checks on, unique becomes a check over all rows after the refresh.
    writeFileSync(
      join(cwd, "platform.yaml"),
      "apiVersion: ingestron.io/v1\nkind: Platform\nid: checks\ndatabricks: { manage: { checks: true } }\n",
    );
    const project = parse(readFileSync(join(cwd, "project.yaml"), "utf8"));
    writeFileSync(
      join(cwd, "project.yaml"),
      stringify({ ...project, imports: [...project.imports, "platform.yaml"] }),
    );
    expect(cli(cwd, ["apply", "--no-diff", "--out", out]).code).toBe(0);
    expect(readFileSync(join(out, "databricks/tasks", id, "apply_contract.py"), "utf8")).toContain(
      '"name": "customer_id_unique"',
    );
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

describe("how-to/start-from-a-template", () => {
  const page = read("how-to/start-from-a-template.mdx");

  it("creates a project from a connection asking nothing, and counts what is still REPLACE_ME", () => {
    const flags = commands(section(page, "## Start from a connection")).find((line) =>
      line.includes("--connector"),
    )!;
    const parent = mkdtempSync(join(tmpdir(), "docs-init-"));
    const asked: string[] = [];
    let output = "";
    const code = run(flags.split(" ").slice(1), {
      cwd: parent,
      write: (text) => (output += text),
      ask: (question) => (asked.push(question), ""),
    });
    expect(code, output).toBe(0);
    expect(asked).toEqual([]);
    const values = section(page, "## Write the values it cannot know [#write-the-values]");
    expect(output.trimEnd().split("\n").at(-1)).toBe(fences(values, "text")[0]!.trim());
    expect(readFileSync(join(parent, "sales", "README.md"), "utf8")).toContain(
      "## Values to replace before deploying",
    );
    // plan counts places, init names: its own last line, as the page shows it.
    const planned = cli(join(parent, "sales"), ["plan", "--no-diff"]);
    expect(planned.code).toBe(0);
    expect(planned.output.trimEnd().split("\n").at(-1)).toBe(fences(values, "text")[1]!.trim());
    // The page's --set writes two of them, one for every environment and one for prod.
    const set = commands(values).find((line) => line.includes("--set"))!;
    const second = mkdtempSync(join(tmpdir(), "docs-init-"));
    const written = cli(second, set.split(" ").slice(1));
    expect(written.code, written.output).toBe(0);
    expect(written.output.trimEnd().split("\n").at(-1)).toBe(
      "6 values are still REPLACE_ME: README.md lists each one and where to find it.",
    );
    const project = readFileSync(join(second, "sales", "project.yaml"), "utf8");
    expect(project).toContain("storage_account: salesprod");
    expect(cli(join(second, "sales"), ["apply", "--no-diff"]).code).toBe(0);
    expect(cli(join(second, "sales"), ["check"]).code).toBe(1);
  });
});
