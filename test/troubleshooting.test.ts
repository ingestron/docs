// The troubleshooting page, entry by entry: each message it quotes is produced
// by the command, the editor or a pack in a copy of a sample, with the change
// that causes it, and each entry's fix is tried where a test can try it. Two
// things come from source instead, as the comments say: a message that needs a
// machine failure, and VS Code's own command.
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { openProject, problems } from "@ingestron/authoring";
import { codeHelp, loadingCodeHelp } from "@ingestron/definitions";
import { describe, expect, it } from "vitest";
import { redirectFor } from "../worker/redirects.js";
import { cli, copy, fences, read, section } from "./pages.js";

const page = read("troubleshooting.mdx");
const entry = (heading: string) => section(page, `### ${heading}`);

/** The trimmed lines of a command's output. */
const lines = (output: string) => output.split("\n").map((line) => line.trim());

/** Every line of the entry's `text` blocks is a line of the output, unless it is listed as a placeholder. */
function quotes(heading: string, output: string, placeholders: string[] = []) {
  const shown = fences(entry(heading), "text").flatMap((block) =>
    block.split("\n").map((line) => line.trim()),
  );
  const printed = lines(output);
  expect(shown.length, `${heading} quotes output`).toBeGreaterThan(0);
  for (const line of shown.filter((line) => line !== "" && !placeholders.includes(line)))
    expect(printed, `"${line}" in the output`).toContain(line);
}

/** Changes a file of a copy of a sample. */
const edit = (folder: string, file: string, change: (text: string) => string) =>
  writeFileSync(join(folder, file), change(readFileSync(join(folder, file), "utf8")));

/** The same change to a sample's definitions, made to every file named. */
const without = (output: string, ...noise: RegExp[]) =>
  lines(output)
    .filter((line) => !noise.some((pattern) => pattern.test(line)))
    .join("\n");

describe("the command", () => {
  it("installs the command as Install a tool does, and finds npm's global folder when the shell cannot", () => {
    const text = entry("`ingestron: command not found` [#ingestron-command-not-found]");
    expect(text).toContain("**Symptom:**");
    // The shells' own messages, which name the command the pages run.
    expect(text).toContain("`bash: ingestron: command not found`");
    expect(text).toContain("`zsh: command not found: ingestron`");
    expect(fences(text, "sh")).toEqual(["npm install -g ingestron\n", "npm prefix -g\n"]);
    expect(fences(read("start/install.mdx"), "sh")[0]).toMatch(/^npm install -g ingestron\n/);
    // The pages that install send a reader here.
    for (const from of ["start/install.mdx", "start/first-project.mdx"])
      expect(read(from), from).toContain("(/docs/troubleshooting#ingestron-command-not-found)");
  });
});

describe("generated files", () => {
  it("plan reports a conflict, and the entry's fix generates the file again", () => {
    const project = copy("duckdb");
    cli(project, ["apply"]);
    appendFileSync(join(project, "build/dev/run.sql"), "-- by hand\n");
    for (const command of ["plan", "apply", "check"]) {
      const { code, output } = cli(project, [command]);
      expect(code).toBe(1);
      quotes("Plan reports a conflict", output);
    }
    expect(read("concepts/generated-files.mdx")).toContain("delete the file to generate it again");
    rmSync(join(project, "build/dev/run.sql"));
    expect(cli(project, ["apply"]).code).toBe(0);
    expect(cli(project, ["check"]).code).toBe(0);
  }, 30_000);

  it("a lock stops apply but not plan or check, and deleting it lets apply finish", () => {
    const project = copy("duckdb");
    cli(project, ["apply"]);
    edit(project, "transforms/customer_totals.yaml", (text) => text.replace("SELECT", "SELECT 1,"));
    const lock = join(project, "build/dev/.generated.lock");
    writeFileSync(lock, "");
    const blocked = cli(project, ["apply", "--no-diff"]);
    expect(blocked.code).toBe(1);
    quotes("Apply stops because of `.generated.lock`", blocked.output);
    // The plan line before the changes names the output folder, as the entry says.
    expect(lines(blocked.output)).toContain("dev → build/dev");
    expect(cli(project, ["plan"]).code).toBe(0);
    expect(cli(project, ["check"]).output).toContain("not up to date");
    rmSync(lock);
    expect(cli(project, ["apply", "--no-diff"]).code).toBe(0);
    expect(existsSync(lock)).toBe(false);
  }, 30_000);

  it("a stopped apply leaves a mix that plan finishes: finished files are unchanged, a .tmp file fails check", () => {
    const project = copy("duckdb");
    const finished = copy("duckdb");
    cli(project, ["apply"]);
    for (const folder of [project, finished])
      edit(folder, "transforms/customer_totals.yaml", (text) =>
        text.replace("SELECT", "SELECT 1,"),
      );
    cli(finished, ["apply"]);
    // The run was stopped after run.sql was written and before the rest.
    writeFileSync(
      join(project, "build/dev/run.sql"),
      readFileSync(join(finished, "build/dev/run.sql"), "utf8"),
    );
    const lock = join(project, "build/dev/.generated.lock");
    const leftover = join(
      project,
      "build/dev/tables/silver.customer_totals.sql.86d515b8-2e82-49b9-b8bd-12dc20af8841.tmp",
    );
    writeFileSync(lock, "");
    writeFileSync(leftover, "half");
    expect(cli(project, ["apply"]).output).toContain("delete .generated.lock");
    const check = cli(project, ["check"]);
    expect(lines(check.output)).toContain(
      "dev: not generated  tables/silver.customer_totals.sql.86d515b8-2e82-49b9-b8bd-12dc20af8841.tmp",
    );
    // The entry's fix: delete the lock and the .tmp file, plan, apply, check.
    rmSync(lock);
    rmSync(leftover);
    const plan = cli(project, ["plan", "--no-diff"]);
    expect(lines(plan.output)).toEqual([
      "dev → build/dev",
      "update    tables/silver.customer_totals.sql",
      "",
      "4 files: 1 update, 3 unchanged. Ready to apply.",
      "",
    ]);
    expect(cli(project, ["apply"]).code).toBe(0);
    expect(cli(project, ["check"]).code).toBe(0);
    expect(entry("An apply stopped part-way")).toContain("`.tmp` file");
  }, 30_000);

  // A user who can write anywhere, such as root, cannot make the write fail this way.
  it.skipIf(process.getuid?.() === 0 || process.platform === "win32")(
    "a failed write puts the files back and says so",
    () => {
      const project = copy("duckdb");
      cli(project, ["apply"]);
      edit(project, "transforms/customer_totals.yaml", (text) =>
        text.replace("SELECT", "SELECT 1,"),
      );
      const before = readFileSync(join(project, "build/dev/run.sql"), "utf8");
      const tables = join(project, "build/dev/tables");
      chmodSync(tables, 0o555);
      try {
        const { code, output } = cli(project, ["apply", "--no-diff"]);
        expect(code).toBe(1);
        const failure = lines(output).find((line) => line.startsWith("Could not write"))!;
        expect(failure.startsWith('Could not write "tables/silver.customer_totals.sql": ')).toBe(
          true,
        );
        expect(failure.endsWith(". Nothing was changed.")).toBe(true);
        expect(entry("An apply stopped part-way")).toContain(
          'Could not write "tables/silver.customer_totals.sql": <reason>. Nothing was changed.',
        );
      } finally {
        chmodSync(tables, 0o755);
      }
      expect(readFileSync(join(project, "build/dev/run.sql"), "utf8")).toBe(before);
      expect(existsSync(join(project, "build/dev/.generated.lock"))).toBe(false);
    },
    30_000,
  );

  it("names an environment that was not applied while the others were", () => {
    const project = copy("environments");
    cli(project, ["apply"]);
    appendFileSync(join(project, "build/prod/databricks.yml"), "# my change\n");
    appendFileSync(join(project, "standard.yaml"), "layers: [raw, curated]\n");
    const { code, output } = cli(project, ["apply", "--no-diff"]);
    expect(code).toBe(1);
    expect(lines(output)).toContain("Applied: dev, test. Not applied: prod.");
    const entryText = entry("An apply stopped part-way");
    expect(entryText).toContain("`Applied: dev, test. Not applied: prod.`");
    // The fix: plan the environment that was not applied, to see its conflict.
    expect(cli(project, ["plan", "--env", "prod"]).output).toContain("conflict  databricks.yml");
  }, 30_000);

  it("keeps the messages put back and not put back as the writer says them", () => {
    // Not produced: a file that cannot be restored needs a second failure. From the shipped writer.
    // pnpm puts the CLI's own dependencies beside it.
    const cliFolder = realpathSync(join(process.cwd(), "node_modules/@ingestron/cli"));
    const writer = readFileSync(join(cliFolder, "../generate/dist/apply.js"), "utf8");
    expect(writer).toContain("Some files could not be put back.");
    expect(writer).toContain("Nothing was changed.");
    expect(entry("An apply stopped part-way")).toContain("`Some files could not be put back.`");
  });

  it("check reports what is out of date, extra, or no longer generated", () => {
    const project = copy("duckdb");
    cli(project, ["apply"]);
    edit(project, "transforms/customer_totals.yaml", (text) => text.replace("SELECT", "SELECT 1,"));
    const stale = cli(project, ["check"]);
    expect(stale.code).toBe(1);
    expect(lines(stale.output)).toContain("dev: not up to date");
    cli(project, ["apply"]);
    writeFileSync(join(project, "build/dev/notes.txt"), "x");
    const extra = cli(project, ["check"]);
    expect(extra.code).toBe(1);
    expect(lines(extra.output)).toContain("dev: not generated  notes.txt");
    mkdirSync(join(project, "build/old"));
    writeFileSync(join(project, "build/old/.generated.json"), '{"files":{}}');
    const retired = cli(project, ["check", "--allow-extra"]);
    expect(retired.code).toBe(1);
    expect(retired.output).toContain("build/old: no longer generated.");
    const text = page;
    expect(text).toContain("`ingestron check` prints `not up to date` and exits with `1`");
    expect(text).toContain("`not generated  <file>` or\n`<folder>: no longer generated`");
  }, 30_000);
});

describe("definitions", () => {
  it("quotes the setting messages", () => {
    const project = copy("duckdb");
    edit(project, "flows/orders.yaml", (text) =>
      text.replace("tables:", "ingest: { with: { frmat: csv } }\ntables:"),
    );
    const misspelt = cli(project, ["plan"]);
    expect(misspelt.output).toContain("BAD_SETTING");
    const synapse = copy("synapse-views");
    edit(synapse, "platform.yaml", (text) => text.replace("    data_source: landing\n", ""));
    const missing = cli(synapse, ["plan", "--env", "dev"]);
    expect(missing.output).toContain("BAD_SETTING");
    quotes("A setting is not accepted", `${misspelt.output}\n${missing.output}`);
  }, 30_000);

  it("quotes the unreadable source, and names the connectivity each method supports", () => {
    const project = copy("duckdb-local");
    edit(project, "flows/erp.yaml", (text) =>
      text.replace("tables:", "ingest: { uses: duckdb-files }\ntables:"),
    );
    const { code, output } = cli(project, ["plan", "--env", "dev"]);
    expect(code).toBe(1);
    expect(output).toContain("CONNECTOR_NOT_SUPPORTED");
    quotes("The method cannot read this source", output);
    // The fix it names works: leave `uses` to the standard.
    edit(project, "flows/erp.yaml", (text) => text.replace("ingest: { uses: duckdb-files }\n", ""));
    expect(cli(project, ["plan", "--env", "dev"]).code).toBe(0);
  }, 30_000);

  it("quotes the duplicate table message", () => {
    const project = copy("duckdb");
    edit(project, "transforms/customer_totals.yaml", (text) =>
      text.replace("id: customer_totals", "id: orders"),
    );
    const { output } = cli(project, ["plan"]);
    expect(output).toContain("DUPLICATE_TABLE");
    quotes("Two tables get the same name", output);
  }, 30_000);

  it("the editor warns about a file no import matches, and the command line says nothing", () => {
    const project = copy("duckdb");
    const transform =
      "apiVersion: ingestron.io/v1\nkind: Transform\nid: more\ninputs: [orders]\ncode: SELECT 1\ncontract: shop.customer_totals\n";
    mkdirSync(join(project, "transforms/finance"));
    writeFileSync(join(project, "transforms/finance/more.yaml"), transform);
    writeFileSync(
      join(project, "transforms/other.yml"),
      transform.replace("id: more", "id: other"),
    );
    const before = cli(project, ["plan"]);
    const found = problems(openProject(project, new Map()), "dev").filter(
      (problem) => problem.code === "NOT_IMPORTED",
    );
    expect(found.map((problem) => problem.file)).toEqual([
      "transforms/finance/more.yaml",
      "transforms/other.yml",
    ]);
    expect(found[0]).toMatchObject({ severity: "warning" });
    expect(found[0]?.fixes?.[0]?.title).toBe('Import "transforms/finance/*.yaml" in project.yaml');
    const text = entry("A new file is not generated");
    expect(text).toContain(found[0]!.message);
    expect(text).toContain(found[0]!.fixes![0]!.title);
    // The command line plans the same files with or without them.
    expect(before.code).toBe(0);
    expect(before.output).not.toContain("more");
    expect(before.output).not.toContain("other");
    // The quick fix: the folder's pattern in imports.
    edit(project, "project.yaml", (text) => `${text}  - transforms/finance/*.yaml\n`);
    const fixed = problems(openProject(project, new Map()), "dev").filter(
      (problem) => problem.code === "NOT_IMPORTED",
    );
    expect(fixed.map((problem) => problem.file)).toEqual(["transforms/other.yml"]);
    // The code is the editor's alone: Errors has no entry for it.
    expect("NOT_IMPORTED" in { ...codeHelp, ...loadingCodeHelp }).toBe(false);
    expect(read("reference/errors.mdx")).not.toContain("NOT_IMPORTED");
  }, 30_000);
});

describe("environment variables and .env", () => {
  const unset = () => {
    const project = copy("duckdb");
    edit(project, "connections/shop.yaml", (text) =>
      text.replace("path: ./samples", "path: ${envvar:SAMPLES_DIR}"),
    );
    delete process.env.SAMPLES_DIR;
    return project;
  };

  it("an unset variable is an error for the command and information in the editor", () => {
    const project = unset();
    const { code, output } = cli(project, ["plan"]);
    expect(code).toBe(1);
    quotes("A variable is not set", output, [
      "SAMPLES_DIR isn't set; add it to .env.dev or set it before running Ingestron.",
    ]);
    const found = problems(openProject(project, new Map()), "dev");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: "ENVVAR_MISSING", severity: "information" });
    expect(found[0]!.message.split("\n")[0]).toBe(
      "SAMPLES_DIR isn't set; add it to .env.dev or set it before running Ingestron.",
    );
    expect(entry("A variable is not set")).toContain(found[0]!.message.split("\n")[0]);
  }, 30_000);

  it("an empty value is unset, and a file sets it for the command and the editor", () => {
    const project = unset();
    writeFileSync(join(project, ".env"), "SAMPLES_DIR=\n");
    expect(cli(project, ["plan"]).output).toContain("ENVVAR_MISSING");
    writeFileSync(join(project, ".env.dev"), "SAMPLES_DIR=./samples\n");
    expect(cli(project, ["plan"]).code).toBe(0);
    expect(problems(openProject(project, new Map()), "dev")).toEqual([]);
    // A variable in the editor's own environment is seen, one exported later is not.
    rmSync(join(project, ".env.dev"));
    rmSync(join(project, ".env"));
    process.env.SAMPLES_DIR = "./samples";
    try {
      expect(problems(openProject(project, new Map()), "dev")).toEqual([]);
    } finally {
      delete process.env.SAMPLES_DIR;
    }
    expect(problems(openProject(project, new Map()), "dev")).toHaveLength(1);
  }, 30_000);

  it("a line that is not a setting is a warning that names the file and line", () => {
    const project = unset();
    writeFileSync(join(project, ".env"), "SAMPLES_DIR ./samples\n");
    const { output } = cli(project, ["plan"]);
    quotes("A line of `.env` is ignored", output.replace(".env:1:1", ".env:1:1"), []);
    // A name with a hyphen is not a setting either, and the line is not quoted.
    writeFileSync(join(project, ".env"), "SAMPLES-DIR=./samples\nSAMPLES_DIR=./samples\n");
    const hyphen = cli(project, ["plan"]);
    expect(hyphen.code).toBe(0);
    expect(hyphen.output).toContain(".env line 1 is not a setting, so it is ignored.");
    expect(hyphen.output).not.toContain("SAMPLES-DIR");
  }, 30_000);
});

describe("Azure Data Factory", () => {
  it("quotes a connection that lacks, or has too many, settings", () => {
    const project = copy("connection-first-adf");
    edit(project, "connections/postgresql.yaml", (text) =>
      text.replace("  server: ${values.source_server}\n", ""),
    );
    const { code, output } = cli(project, ["plan", "--no-diff", "--env", "dev"]);
    expect(code).toBe(1);
    quotes("A connection is missing a setting", output);
    const extra = copy("connection-first-adf");
    appendFileSync(join(extra, "connections/postgresql.yaml"), "  ssl: true\n");
    expect(cli(extra, ["plan", "--no-diff", "--env", "dev"]).output).toContain(
      'the connection setting "ssl" is not supported for postgresql',
    );
    expect(entry("A connection is missing a setting")).toContain(
      'the connection setting "ssl" is not supported for postgresql',
    );
  }, 30_000);

  it("lists the prerequisites that generation does not check", () => {
    const project = copy("connection-first-adf");
    const { output } = cli(project, ["request", "--env", "dev"]);
    expect(lines(output)).toContain("## ADF prerequisites");
    expect(output).toContain("Generation does not inspect Azure or validate source credentials.");
    expect(output).toMatch(/Integration runtime `[^`]+` \(self-hosted\)/);
    expect(output).toContain("Key Vault `");
    expect(output).toContain("Landing `");
    const text = entry("A pipeline fails when it runs");
    expect(text).toContain("**ADF prerequisites**");
    expect(text).toContain("`ingestron request --env dev`");
  }, 30_000);

  it("generates development triggers stopped, and started with paused: false", () => {
    const project = copy("connection-first-adf");
    cli(project, ["apply"]);
    const trigger = (folder: string, environment: string) =>
      readFileSync(
        join(folder, `build/${environment}/adf/trigger/tr_sales_orders_${environment}.json`),
        "utf8",
      );
    expect(trigger(project, "dev")).toContain('"runtimeState": "Stopped"');
    expect(trigger(project, "prod")).toContain('"runtimeState": "Started"');
    const started = copy("connection-first-adf");
    edit(started, "platform.yaml", (text) =>
      text.replace("    landing:", "    paused: false\n    landing:"),
    );
    cli(started, ["apply"]);
    expect(trigger(started, "dev")).toContain('"runtimeState": "Started"');
    const text = entry("Development triggers do not run");
    expect(text).toContain('`"runtimeState": "Stopped"`');
    expect(text).toContain('`"Started"`');
    expect(text).toContain("`paused: false`");
  }, 30_000);
});

describe("Synapse serverless views", () => {
  const noise = [/CONTRACT_FIELD_UNUSED/, /^required of /, /^synapse: Synapse views check no rows/];

  it("quotes a view that starts with WITH, and an input the SQL does not list", () => {
    const project = copy("synapse-views");
    edit(project, "transforms/customer_totals.yaml", (text) =>
      text.replace("code: |\n  SELECT", "code: |\n  WITH x AS (SELECT 1)\n  SELECT"),
    );
    const { code, output } = cli(project, ["plan", "--no-diff", "--env", "dev"]);
    expect(code).toBe(1);
    quotes("A view's SQL starts with WITH", without(output, ...noise));
    const unlisted = copy("synapse-views");
    edit(unlisted, "transforms/customer_totals.yaml", (text) =>
      text.replace("{{ tables.invoices }}", "{{ tables.customers }}"),
    );
    expect(cli(unlisted, ["plan", "--no-diff", "--env", "dev"]).output).toContain(
      "the SQL names {{ tables.customers }}, which is not in inputs",
    );
    expect(entry("A view's SQL starts with WITH")).toContain(
      "`the SQL names {{ tables.customers }}, which is not in inputs`",
    );
  }, 30_000);

  it("quotes files outside the data source", () => {
    const project = copy("synapse-views");
    edit(project, "project.yaml", (text) =>
      text.replace(
        "storage: abfss://landing@saleslakedev.dfs.core.windows.net",
        "storage: abfss://other@saleslakedev.dfs.core.windows.net",
      ),
    );
    const { code, output } = cli(project, ["plan", "--no-diff", "--env", "dev"]);
    expect(code).toBe(1);
    // The entry shows the first of the two tables.
    quotes("A view reads files outside the data source", without(output, ...noise));
  }, 30_000);

  it("lists what to create in Synapse before views.sql runs", () => {
    const project = copy("synapse-views");
    const { output } = cli(project, ["request", "--env", "dev"]);
    for (const heading of ["Synapse serverless database", "External data source", "Report users"])
      expect(lines(output)).toContain(`## ${heading}`);
    expect(entry("Running views.sql fails the first time")).toContain(
      "**Synapse serverless database**,\n**External data source** and **Report users**",
    );
    cli(project, ["apply"]);
    expect(existsSync(join(project, "build/dev/synapse/views.sql"))).toBe(true);
  }, 30_000);
});

describe("DuckDB", () => {
  const noise: RegExp[] = [];

  it("quotes append over a file that is replaced, and upsert without a key", () => {
    const append = copy("duckdb-local");
    appendFileSync(
      join(append, "standard.yaml"),
      "store:\n  settings:\n    duckdb-table: { mode: append }\n",
    );
    const appended = cli(append, ["plan", "--no-diff", "--env", "dev"]);
    expect(appended.code).toBe(1);
    quotes("Append would miss later loads", without(appended.output, ...noise));
    const upsert = copy("duckdb-local");
    edit(upsert, "contracts/invoices.yaml", (text) =>
      text.replace("          primaryKey: true,\n", ""),
    );
    appendFileSync(
      join(upsert, "standard.yaml"),
      "store:\n  settings:\n    duckdb-table: { mode: upsert }\n",
    );
    const upserted = cli(upsert, ["plan", "--no-diff", "--env", "dev"]);
    expect(upserted.code).toBe(1);
    quotes("Upsert needs a primary key", upserted.output);
    // The fixes work: replace, or a key.
    edit(append, "standard.yaml", (text) => text.replace("mode: append", "mode: replace"));
    expect(cli(append, ["plan", "--no-diff", "--env", "dev"]).code).toBe(0);
  }, 30_000);

  it("tells the reader to run with -bail, and that the published folder must exist", () => {
    const project = copy("duckdb");
    cli(project, ["apply"]);
    const readme = readFileSync(join(project, "build/dev/README.md"), "utf8");
    expect(readme).toContain(
      "With `-bail`, a run that\nfails while building publishes nothing; without it, DuckDB carries on after an\nerror and commits what it built.",
    );
    const command = fences(entry("A run keeps going after an error"), "sh")[0]!.trim();
    expect(command).toBe('duckdb -bail ingestron.duckdb -c ".read build/dev/run.sql"');
    expect(readme).toContain(command);
    expect(readme).toContain("the folder must exist");
    expect(entry("Publishing fails after the tables are built")).toContain(
      "that folder must exist",
    );
    expect(readFileSync(join(project, "build/dev/run.sql"), "utf8")).toContain(
      "-- Published only once every table is built.",
    );
  }, 30_000);

  it("says when an environment mixes local and Azure paths, in the README and the request", () => {
    const project = copy("duckdb-local");
    edit(project, "project.yaml", (text) =>
      text.replace("  dev: {}", "  dev:\n    values:\n      published: ./published"),
    );
    cli(project, ["apply"]);
    const readme = readFileSync(join(project, "build/dev/duckdb/README.md"), "utf8");
    const [paragraph] = fences(entry("Paths mix local and Azure"), "text");
    expect(readme).toContain(paragraph!.trim());
    const { output } = cli(project, ["request", "--env", "dev"]);
    expect(output).toContain("give this environment only paths in Azure storage");
    expect(entry("Paths mix local and Azure")).toContain(
      "`give this environment only paths in Azure storage`",
    );
    // The laptop environment of the same project has only local paths.
    expect(readFileSync(join(project, "build/local/duckdb/README.md"), "utf8")).not.toContain(
      "both local paths",
    );
  }, 30_000);

  it("quotes what the pipeline after the copies says when the job fails or times out", () => {
    const project = copy("duckdb-local");
    cli(project, ["apply"]);
    const folder = join(project, "build/dev/adf/pipeline");
    expect(readdirSync(folder)).toContain("pl_sales_every_24_hour.json");
    const pipeline = readFileSync(join(folder, "pl_sales_every_24_hour.json"), "utf8");
    expect(pipeline).toContain("The job after the copies ended ', variables('job_status'), '.'");
    expect(pipeline).toContain(
      "The job after the copies did not finish within 01:00:00, so it was stopped.",
    );
    expect(pipeline).toContain(
      "The job after the copies did not finish within 01:00:00 and could not be stopped: ",
    );
    expect(pipeline).toContain('"waitTimeInSeconds": 30');
    expect(entry("The job after the copies fails or times out")).toContain(
      "`pl_<project>_every_<interval>_<unit>`",
    );
    const { output } = cli(project, ["request", "--env", "dev"]);
    expect(output).toContain("Container Apps Jobs Operator");
    expect(output).toContain("retry limit to 1");
  }, 30_000);
});

describe("Databricks", () => {
  it("quotes a change mode without a sequence column, and without a key", () => {
    const project = copy("change-data");
    edit(project, "flows/crm.yaml", (text) =>
      text.replace("mode: upsert,\n          sequence_by: changed_at,", "mode: upsert,"),
    );
    const { code, output } = cli(project, ["plan", "--no-diff"]);
    expect(code).toBe(1);
    quotes("A change mode needs a key or a sequence column", output);
    const keyless = copy("change-data");
    const contract = read("how-to/keep-a-table-current.mdx");
    expect(contract).toContain("primary");
    edit(keyless, "contracts/accounts.yaml", (text) => text.replace(/\s*primaryKey: true,?/g, ""));
    expect(cli(keyless, ["plan", "--no-diff"]).output).toContain(
      "mode upsert needs primary key columns in the contract",
    );
    expect(entry("A change mode needs a key or a sequence column")).toContain(
      "`mode upsert needs primary key columns in the contract`",
    );
  }, 30_000);

  it("generates prerequisites.sql for managed schemas, and a paused development job", () => {
    const project = copy("platform-setup");
    cli(project, ["apply"]);
    const grants = readFileSync(join(project, "build/dev/prerequisites.sql"), "utf8");
    expect(grants).toContain("GRANT USE CATALOG, CREATE SCHEMA ON CATALOG `hr_dev` TO `");
    expect(grants).toContain("The grants go to run_as; give the same to the identity that deploys");
    const job = (folder: string, environment: string) =>
      readFileSync(join(folder, `build/${environment}/resources/hr_refresh.job.yml`), "utf8");
    expect(job(project, "dev")).toContain("pause_status: PAUSED");
    expect(job(project, "prod")).toContain("pause_status: UNPAUSED");
    const unpaused = copy("platform-setup");
    edit(unpaused, "platform.yaml", (text) =>
      text.replace("  cron: 0 0 2 * * ?", "  cron: 0 0 2 * * ?\n  paused: false"),
    );
    cli(unpaused, ["apply"]);
    expect(job(unpaused, "dev")).toContain("pause_status: UNPAUSED");
    const text = entry("The refresh job does not run in development");
    expect(text).toContain("`pause_status: PAUSED`");
    expect(entry("Databricks rejects the bundle")).toContain("`USE CATALOG` and `CREATE SCHEMA`");
  }, 30_000);
});

describe("links", () => {
  const links = [...page.matchAll(/\]\((\/docs\/[^)\s]*)\)/g)].map((match) => match[1]!);
  const slug = (heading: string) =>
    heading
      .replace(/`/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9 _-]/g, "")
      .replace(/ /g, "-");
  const anchors = (text: string) =>
    text
      .split("\n")
      .filter((line) => /^#{2,4} /.test(line))
      .map((line) => /\[#([^\]]+)\]$/.exec(line)?.[1] ?? slug(line.replace(/^#+ /, "")));
  const pageOf = (path: string) => {
    for (const candidate of [`${path}.mdx`, `${path}/index.mdx`]) {
      if (existsSync(join(process.cwd(), "content/docs", candidate))) return read(candidate);
    }
    return undefined;
  };

  it("point at built pages and anchors, never at a connector chapter or a redirect", () => {
    expect(links.length).toBeGreaterThan(20);
    const codes = new Set(Object.keys({ ...codeHelp, ...loadingCodeHelp }));
    for (const link of links) {
      const [path = "", anchor] = link.split("#");
      expect(redirectFor(new URL(path, "https://docs.ingestron.io")), `${link} redirects`).toBe(
        undefined,
      );
      expect(path, `${link} is a connector chapter`).not.toMatch(/^\/docs\/connectors\/[^/]+\//);
      const text = pageOf(path.replace(/^\/docs\//, ""));
      expect(text, `${link} has a page`).toBeDefined();
      if (!anchor) continue;
      if (path === "/docs/reference/errors") expect(codes, link).toContain(anchor);
      else expect(anchors(text!), link).toContain(anchor);
    }
  });

  it("point at this page's own entries", () => {
    const own = anchors(page);
    const inPage = [...page.matchAll(/\]\((#[^)\s]+)\)/g)].map((match) => match[1]!.slice(1));
    expect(inPage.length).toBeGreaterThan(0);
    for (const anchor of inPage) expect(own).toContain(anchor);
  });

  it("links every error code the entries name, and gives each entry a symptom and a fix", () => {
    for (const code of [
      "BAD_SETTING",
      "CONNECTOR_NOT_SUPPORTED",
      "CONNECTIVITY_NOT_SUPPORTED",
      "DUPLICATE_TABLE",
      "DUPLICATE_NAME",
      "ENVVAR_MISSING",
      "ENV_FILE_LINE",
    ])
      expect(page).toContain(`(/docs/reference/errors#${code})`);
    const headings = page.split("\n").filter((line) => line.startsWith("### "));
    expect(headings.length).toBeGreaterThanOrEqual(25);
    for (const heading of headings) {
      const text = entry(heading.slice(4));
      expect(text, heading).toContain("**Symptom:**");
      expect(text, heading).toContain("**Fix:**");
    }
  });
});
