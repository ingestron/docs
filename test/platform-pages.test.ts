// The platform pages, run as they show them: each command
// is read from the page and run, and each output block is compared with what
// the command prints, so the pages and the product cannot drift apart. The
// pages' hand-written YAML fragments, which no sample holds, are applied to a
// sample and generated, so they stay valid.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { requestSections } from "../lib/examples.js";
import {
  cli,
  command,
  commands,
  copy,
  fences,
  merge,
  read,
  requestUses,
  section,
} from "./pages.js";

describe("platforms/databricks", () => {
  const page = read("platforms/databricks.mdx");

  it("prints the retail project's plan and its deliberate break as the page shows", () => {
    const example = section(page, "## Work through the retail project");
    const create = commands(example);
    expect(create[1], "the page changes into the project").toMatch(/^cd /);
    const parent = mkdtempSync(join(tmpdir(), "docs-databricks-retail-"));
    expect(cli(parent, command(create, "init")).code).toBe(0);
    const cwd = join(parent, create[1]!.slice("cd ".length));

    const generate = section(page, "### 5. Generate");
    const plan = command(commands(generate), "plan");
    const planned = cli(cwd, plan);
    expect(planned.code).toBe(0);
    expect(planned.output.trim()).toBe(fences(generate, "text")[0]!.trim());

    // "plan again": the same command, after the change the page names.
    const transform = join(cwd, "transforms/daily_sales.yaml");
    const original = readFileSync(transform, "utf8");
    writeFileSync(transform, original.replace(/^id: daily_sales$/m, "id: orders"));
    const broken = cli(cwd, plan);
    expect(broken.code).toBe(1);
    expect(broken.output.trim()).toBe(
      fences(section(page, "### 6. Break it on purpose"), "text")[0]!.trim(),
    );
  });
});

describe("platforms/adf", () => {
  const page = read("platforms/adf.mdx");

  it("lists the ADF prerequisites the platform request prints", () => {
    const prerequisites = section(page, "## Platform prerequisites");
    const written = /`(ingestron request [^`]+)`/.exec(prerequisites);
    expect(written, "the request command, in the prose").not.toBeNull();
    // The page shows the request's last section, rendered from the finished project.
    expect(requestUses(prerequisites)).toEqual([
      { name: "connection-first-adf", env: "dev", sections: ["ADF prerequisites"] },
    ]);
    const request = cli(copy("connection-first-adf"), written![1]!.split(" ").slice(1));
    expect(request.code).toBe(0);
    expect(
      request.output
        .trimEnd()
        .endsWith(requestSections("connection-first-adf", "dev", ["ADF prerequisites"])),
      "the request ends with the section the page shows",
    ).toBe(true);
  });

  it("prints the factory's files after the Databricks ones, and the missing-server problem", () => {
    const cwd = copy("connection-first-adf");
    const generate = section(page, "## Generate and inspect");
    const plan = command(commands(generate), "plan");
    const [files, problem] = fences(generate, "text");
    const planned = cli(cwd, plan);
    expect(planned.code).toBe(0);
    const databricks = planned.output.indexOf("dev/databricks → build/dev/databricks");
    const adf = planned.output.indexOf(files!.trim());
    expect(databricks, "the Databricks files").toBeGreaterThan(-1);
    expect(adf, "the page's ADF files").toBeGreaterThan(databricks);

    // "plan again", without the field the page removes.
    const connection = join(cwd, "connections/postgresql.yaml");
    writeFileSync(connection, readFileSync(connection, "utf8").replace(/^ {2}server: .*\n/m, ""));
    const broken = cli(cwd, plan);
    expect(broken.code).toBe(1);
    expect(broken.output.trim()).toBe(problem!.trim());
  });

  it("stops only the copies with the pause fragment, in the finished project's method", () => {
    const [fragment] = fences(section(page, "### Retry and pause"), "yaml");
    const cwd = copy("connection-first-adf");
    const method = Object.keys(parse(readFileSync(join(cwd, "platform.yaml"), "utf8")).settings);
    expect(Object.keys(parse(fragment!).settings)).toEqual(method);
    merge(join(cwd, "platform.yaml"), fragment!);
    const out = join(cwd, "out");
    expect(cli(cwd, ["apply", "--env", "prod", "--no-diff", "--out", out]).code).toBe(0);
    const trigger = JSON.parse(
      readFileSync(join(out, "prod/adf/trigger/tr_sales_orders_prod.json"), "utf8"),
    );
    // Production triggers start by default; the fragment stops this one.
    expect(trigger.properties.runtimeState).toBe("Stopped");
  });
});

describe("platforms/adf-pipelines", () => {
  it("shows the Northwind example's standard, whose pipeline has the design the page describes", () => {
    const page = read("platforms/adf-pipelines.mdx");
    expect(page).toContain('<Example name="northwind" file="standard.yaml" pick="ingest" />');
    expect(fences(page, "yaml"), "no hand-written YAML").toEqual([]);
    const cwd = copy("northwind");
    const out = join(cwd, "out");
    const applied = cli(cwd, ["apply", "--env", "dev", "--no-diff", "--out", out]);
    expect(applied.code, applied.output).toBe(0);
    const pipeline = JSON.parse(
      readFileSync(join(out, "dev/adf/pipeline", pipelineFile(applied.output)), "utf8"),
    );
    const [forEach] = pipeline.properties.activities;
    expect(forEach.name).toBe("for_each_table");
    expect(forEach.typeProperties.batchCount).toBe(4);
    const [copyTable] = forEach.typeProperties.activities;
    expect(copyTable.name).toBe("copy_table");
    expect(copyTable.userProperties).toEqual([{ name: "table", value: "@item().table" }]);
    expect(
      copyTable.typeProperties.source.additionalColumns.map(
        (column: { name: string }) => column.name,
      ),
    ).toEqual(["_loaded_at", "_run_id", "_source"]);
    expect(pipeline.properties.folder.name).toBe("ingestron/northwind");
    expect(pipeline.properties.annotations).toContain("northwind");
  });
});

const duckdb = spawnSync("duckdb", ["--version"], { encoding: "utf8" }).status === 0;

describe("platforms/duckdb", () => {
  it(`shows the tables a run builds, as DuckDB prints them${duckdb ? "" : " (skipped: no duckdb on the PATH)"}`, ({
    skip,
  }) => {
    if (!duckdb) skip();
    const shown = section(read("platforms/duckdb.mdx"), "## What it looks like in DuckDB");
    const cwd = copy("duckdb");
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
    const run = (args: string[]) =>
      spawnSync("duckdb", ["-cmd", ".mode duckbox", ...args], { cwd, encoding: "utf8" });
    expect(run(["-bail", "ingestron.duckdb", "-c", ".read build/dev/run.sql"]).status).toBe(0);
    const [query] = commands(shown);
    const words = [...query!.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2]!);
    expect(words.slice(0, 3)).toEqual(["duckdb", "ingestron.duckdb", "-c"]);
    const result = run(words.slice(1));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(fences(shown, "text")[0]);
  });
});

/** The one pipeline file a plan or apply lists. */
function pipelineFile(output: string): string {
  const found = [...output.matchAll(/create {4}pipeline\/(\S+\.json)/g)].map((match) => match[1]!);
  expect(found, "one generated pipeline").toHaveLength(1);
  return found[0]!;
}
