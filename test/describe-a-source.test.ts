// "Describe a source", run as the page shows it: the project its `init` makes,
// each command it runs, each file it saves or adds to, and each output, draft
// and metadata it shows, compared with what the command prints and writes.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectSnapshot } from "@ingestron/authoring";
import { installedSourceRecipes } from "@ingestron/core";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { recipesFolder } from "../lib/recipes";
import { cli, commands, fences, read, section } from "./pages.js";

const page = read("how-to/describe-a-source.mdx");
const part = (heading: string) => section(page, heading);
const lines = commands(page);

/** The arguments of a command the page shows, which must be there exactly as written. */
function shown(line: string): string[] {
  expect(lines, line).toContain(line);
  return line.split(" ").slice(1);
}

/**
 * The page shows the request as Ingestron's own catalogue of recipes gives it. When the
 * command these tests run has no catalogue installed, the project keeps the `sqlserver`
 * recipe as its own, and the request then names the recipe's file, which this leaves out.
 */
const installed = installedSourceRecipes().some((recipe) => recipe.id === "sqlserver");
const asInstalled = (text: string) =>
  text.replace(" (`sqlserver`, from `recipes/sqlserver.yaml`)", " (`sqlserver`)");

/** The time of each import, as the page writes it, for output that holds the time of the run. */
const asOnPage = (text: string) =>
  text
    .replace(/at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, "at: 2026-11-13T09:30:00Z")
    .replace(/captured \d{4}-\d{2}-\d{2}/g, "captured 2026-11-13");

/** The `sales` project the page creates, generated, and with the recipe the request uses. */
function sales(): string {
  const parent = mkdtempSync(join(tmpdir(), "docs-describe-a-source-"));
  const init = lines.find((line) => line.startsWith("ingestron init "))!;
  const created = cli(parent, shown(init));
  expect(created.code, created.output).toBe(0);
  expect(created.output).toContain("Nothing to replace: the project runs as written.");
  const cwd = join(parent, lines.find((line) => line.startsWith("cd "))!.slice("cd ".length));
  expect(cli(cwd, shown("ingestron apply")).code).toBe(0);
  if (!installed) {
    mkdirSync(join(cwd, "recipes"));
    copyFileSync(join(recipesFolder, "sqlserver.yaml"), join(cwd, "recipes/sqlserver.yaml"));
  }
  return cwd;
}

const text = (cwd: string, file: string) => readFileSync(join(cwd, file), "utf8");

/** Adds the page's lines at the end of a file, as a reader does. */
const append = (cwd: string, file: string, lines: string) =>
  writeFileSync(join(cwd, file), `${text(cwd, file)}${lines}`);

/** Writes the page's table line under the flow's `tables`, after the tables `init` wrote, keeping the file's comments and lines. */
function table(cwd: string, line: string): void {
  const flow = text(cwd, "flows/erp.yaml");
  const payments = /^ {2}payments:.*\n/m;
  writeFileSync(
    join(cwd, "flows/erp.yaml"),
    payments.test(flow)
      ? flow.replace(payments, line)
      : flow.replace(/^ingest:/m, `${line}ingest:`),
  );
}

/** Runs a command the page shows and returns what it printed, after checking its exit code. */
function ran(cwd: string, line: string, code = 0): string {
  const result = cli(cwd, shown(line));
  expect(result.code, result.output).toBe(code);
  return result.output;
}

describe("how-to/describe-a-source", () => {
  it("asks for the metadata, imports the catalog, loads a table without a contract and drafts the one needed", () => {
    const cwd = sales();

    // Ask for the metadata, with the recipe's input in the connection.
    const ask = part("## Ask for the metadata [#request]");
    append(cwd, "connections/erp.yaml", fences(ask, "yaml")[0]!);
    const request = ran(cwd, "ingestron source request");
    expect(asInstalled(request)).toContain(fences(ask, "text")[0]!.trim());
    expect(request).toContain("Save the result as `sources/erp.catalog.csv`.");
    expect(request).toContain("s.name IN ('dbo')");
    expect(request).toContain("### If that cannot be done");

    // Save the catalog's result, check it, then import it.
    const catalog = part("### The recipe's query or call [#catalog]");
    expect(catalog.replace(/\s+/g, " ")).toContain("saves the result as `sources/erp.catalog.csv`");
    mkdirSync(join(cwd, "sources"));
    writeFileSync(join(cwd, "sources/erp.catalog.csv"), fences(catalog, "csv")[0]!);
    const imported = part("## Import it [#import]");
    const [dry, wrote] = fences(imported, "text");
    expect(ran(cwd, "ingestron source import erp sources/erp.catalog.csv --dry-run").trim()).toBe(
      dry!.trim(),
    );
    expect(ran(cwd, "ingestron source import erp sources/erp.catalog.csv").trim()).toBe(
      wrote!.trim(),
    );
    expect(parse(text(cwd, "project.yaml")).imports).toContain("sources/erp.yaml");
    expect(asOnPage(text(cwd, "sources/erp.yaml"))).toContain(fences(imported, "yaml")[0]!);
    expect(asOnPage(ran(cwd, "ingestron source request"))).toContain(
      fences(imported, "text")[2]!.trim(),
    );

    // A table without a contract takes its columns and key from the metadata.
    const without = part("## Load a table without a contract [#without-a-contract]");
    table(cwd, fences(without, "yaml")[0]!);
    expect(ran(cwd, "ingestron plan")).toContain(fences(without, "text")[0]!.trim());
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);

    // Grants make it need a contract; the draft is the one the page shows.
    const needs = part("## When a table needs a contract [#needs-a-contract]");
    const [grants, draft, named] = fences(needs, "yaml");
    append(cwd, "platform.yaml", grants!);
    const [problem, drafted] = fences(needs, "text");
    const failed = cli(cwd, ["plan", "--no-diff"]);
    expect(failed.code).toBe(1);
    expect(failed.output).toContain(problem!.trim());
    // VS Code's fix for the problem, as the page names it.
    const snapshot = ProjectSnapshot.open(cwd);
    const needed = snapshot.problems("dev").find((found) => found.code === "CONTRACT_NEEDED")!;
    const fix = snapshot
      .quickFixes("dev", needed.file, needed.range)
      .find((found) => found.problem?.code === "CONTRACT_NEEDED");
    expect(needs.replace(/\s+/g, " ")).toContain(`**${fix!.title}**`);
    expect(ran(cwd, "ingestron contract --from-metadata --needed").trim()).toBe(drafted!.trim());
    expect(asOnPage(text(cwd, "contracts/erp.payments.yaml"))).toBe(draft);
    table(cwd, named!);
    expect(cli(cwd, ["plan", "--no-diff"]).code).toBe(0);
  }, 120_000);

  it("reports what changed at the source, fails on a breaking change, and warns or accepts it as the platform says", () => {
    const cwd = sales();
    append(
      cwd,
      "connections/erp.yaml",
      fences(part("## Ask for the metadata [#request]"), "yaml")[0]!,
    );
    mkdirSync(join(cwd, "sources"));
    const csv = fences(part("### The recipe's query or call [#catalog]"), "csv")[0]!;
    writeFileSync(join(cwd, "sources/erp.catalog.csv"), csv);
    expect(cli(cwd, ["source", "import", "erp", "sources/erp.catalog.csv"]).code).toBe(0);

    // The ERP drops the invoices' status and adds due_on, as the page says.
    const changes = part("## When the source changes [#changes]");
    expect(changes.replace(/\s+/g, " ")).toContain(
      "drops the invoices' `status` and adds `due_on`",
    );
    const status = "ERP,dbo,Invoices,status,4,nvarchar(20),YES,";
    expect(csv).toContain(status);
    writeFileSync(
      join(cwd, "sources/erp.catalog.csv"),
      csv.replace(status, "ERP,dbo,Invoices,due_on,4,date,YES,"),
    );
    const [reimported, gone] = fences(changes, "text");
    expect(cli(cwd, ["source", "import", "erp", "sources/erp.catalog.csv"]).output.trim()).toBe(
      reimported!.trim(),
    );
    for (const command of [["plan", "--no-diff"], ["check"]]) {
      const failed = cli(cwd, command);
      expect(failed.code).toBe(1);
      expect(failed.output).toContain(gone!.trim());
    }

    const [warn, accept] = fences(changes, "yaml");
    append(cwd, "platform.yaml", warn!);
    const warned = cli(cwd, ["plan", "--no-diff"]);
    expect(warned.code).toBe(0);
    expect(warned.output).toContain("warning  SOURCE_COLUMN_GONE");
    append(cwd, "platform.yaml", accept!);
    const accepted = cli(cwd, ["plan", "--no-diff"]);
    expect(accepted.code).toBe(0);
    expect(accepted.output).not.toContain("SOURCE_COLUMN_GONE");
    expect(accepted.output).toContain("1 accepted warning (platform.yaml)");
    expect(changes).toContain("`1 accepted warning (platform.yaml)`");
    // The reason's table reads the column the source dropped.
    expect(text(cwd, "transforms/customer_balances.sql")).toContain("i.status");
    expect(accept).toContain("customer_balances");
  }, 120_000);

  it("reads a nested JSON sample into the columns the page shows, and keeps no value", () => {
    const cwd = sales();
    const sample = part("### A sample of each table [#sample]");
    const file = "sources/erp/ERP.dbo.Orders.json";
    expect(sample).toContain(`saved as \`${file}\``);
    mkdirSync(join(cwd, "sources/erp"), { recursive: true });
    const json = fences(sample, "json")[0]!;
    writeFileSync(join(cwd, file), json);
    expect(cli(cwd, ["source", "import", "erp", file]).code).toBe(0);
    const metadata = asOnPage(text(cwd, "sources/erp.yaml"));
    expect(metadata).toContain(fences(sample, "yaml")[0]!);
    for (const value of ["Ana", "gold", "A-1", "2026-11-02", "40.5", "1001", "tier", "gift"])
      expect(metadata).not.toContain(value);
  }, 60_000);

  it("offers an assistant's columns file once the project has a guide", () => {
    const cwd = sales();
    const assistant = part("### A coding assistant's columns file [#assistant]");
    expect(cli(cwd, shown("ingestron assistant add agents")).code).toBe(0);
    expect(assistant).toContain("`sources/<connection>.assistant.csv`");
    const guide = text(cwd, "AGENTS.md");
    expect(guide).toContain("sources/<connection>.assistant.csv");
    expect(guide).toContain("--dry-run");
    expect(cli(cwd, ["source", "request"]).output).toContain(
      "saved as `sources/erp.assistant.csv`",
    );
  }, 60_000);
});
