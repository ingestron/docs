// The platform pages, run as they show them: each command
// is read from the page and run, and each output block is compared with what
// the command prints, so the pages and the product cannot drift apart. The
// pages' hand-written YAML fragments, which no sample holds, are applied to a
// sample and generated, so they stay valid.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@ingestron/cli";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { exampleFolder, readTemplateExtract, requestSections } from "../lib/examples.js";
import {
  cli,
  command,
  commands,
  copy,
  definitions,
  fences,
  merge,
  read,
  requestUses,
  section,
} from "./pages.js";

describe("platforms/databricks", () => {
  const page = read("platforms/databricks.mdx");

  it("creates the retail project, or the same with --set, from one parent folder, and plans each as the page says", () => {
    const create = section(page, "## Create it");
    const prose = create.replace(/\s+/g, " ");
    const [bare, cd, filled, cdAgain, plan] = commands(create);
    expect([cd, cdAgain]).toEqual(["cd retail", "cd retail"]);
    // The first block: the starter as init writes it, its values still REPLACE_ME.
    const first = mkdtempSync(join(tmpdir(), "docs-databricks-retail-"));
    const created = cli(first, bare!.split(" ").slice(1));
    expect(created.code).toBe(0);
    expect(prose).toContain(`\`${created.output.trimEnd().split("\n").at(-1)}\``);
    const unfilled = cli(join(first, "retail"), plan!.split(" ").slice(1));
    expect(unfilled.code).toBe(0);
    expect(prose).toContain(`\`${unfilled.output.trimEnd().split("\n").at(-1)}\``);
    // The alternative, from a parent folder of its own: the sample, and the plan shown.
    const second = mkdtempSync(join(tmpdir(), "docs-databricks-retail-"));
    const written = cli(second, filled!.split(" ").slice(1));
    expect(written.code, written.output).toBe(0);
    expect(written.output).toContain("Nothing to replace: the project runs as written.");
    const cwd = join(second, "retail");
    expect(definitions(cwd)).toEqual(definitions(exampleFolder("retail-filled")));
    const planned = cli(cwd, plan!.split(" ").slice(1));
    expect(planned.code).toBe(0);
    expect(planned.output.trim()).toBe(fences(create, "text")[0]!.trim());
  });
});

describe("platforms/adf", () => {
  const page = read("platforms/adf.mdx");

  it("lists the ADF prerequisites the platform request prints", () => {
    const prerequisites = section(read("platforms/adf-deploy.mdx"), "## Before you deploy");
    const written = /`(ingestron request [^`]+)`/.exec(prerequisites);
    expect(written, "the request command, in the prose").not.toBeNull();
    // The page shows the request's last section, rendered from the starter.
    expect(requestUses(prerequisites)).toEqual([
      { name: "private-sql-server-filled", env: "prod", sections: ["ADF prerequisites"] },
    ]);
    const request = cli(copy("private-sql-server-filled"), written![1]!.split(" ").slice(1));
    expect(request.code).toBe(0);
    expect(
      request.output
        .trimEnd()
        .endsWith(requestSections("private-sql-server-filled", "prod", ["ADF prerequisites"])),
      "the request ends with the section the page shows",
    ).toBe(true);
  });

  it("creates the starter, or the same with --set, from one parent folder, and plans each as the page says", () => {
    const create = section(page, "## Create it");
    const prose = create.replace(/\s+/g, " ");
    const [bare, cd, filled, cdAgain, plan] = commands(create);
    expect([cd, cdAgain]).toEqual(["cd erp", "cd erp"]);
    const first = mkdtempSync(join(tmpdir(), "docs-adf-erp-"));
    const created = cli(first, bare!.split(" ").slice(1));
    expect(created.code).toBe(0);
    expect(prose).toContain(`\`${created.output.trimEnd().split("\n").at(-1)}\``);
    const unfilled = cli(join(first, "erp"), plan!.split(" ").slice(1));
    expect(unfilled.code).toBe(0);
    expect(prose).toContain(`\`${unfilled.output.trimEnd().split("\n").at(-1)}\``);
    // With --set for each value, on the day the sample was made, it is the sample.
    const second = mkdtempSync(join(tmpdir(), "docs-adf-erp-"));
    const sample = exampleFolder("private-sql-server-filled");
    const day = /start: (\S+)/.exec(readFileSync(join(sample, "standard.yaml"), "utf8"))![1]!;
    let output = "";
    const code = run(filled!.split(" ").slice(1), {
      cwd: second,
      write: (text) => (output += text),
      now: () => new Date(day),
    });
    expect(code, output).toBe(0);
    const cwd = join(second, "erp");
    expect(definitions(cwd)).toEqual(definitions(sample));
    const planned = cli(cwd, plan!.split(" ").slice(1));
    expect(planned.code).toBe(0);
    expect(planned.output.trim()).toBe(fences(create, "text")[0]!.trim());
    // The notice is a warning: check still passes once applied.
    expect(cli(cwd, ["apply", "--no-diff"]).code).toBe(0);
    expect(cli(cwd, ["check"]).code).toBe(0);
  });

  it("stops only the copies with paused under the method's settings, as Shape ADF pipelines says", () => {
    const retry = section(read("platforms/adf-pipelines.mdx"), "### Retry and pause").replace(
      /\s+/g,
      " ",
    );
    expect(retry).toContain("set `paused: true` under `settings.adf-copy` in the platform");
    const fragment = "settings:\n  adf-copy:\n    paused: true\n";
    const cwd = copy("private-sql-server-filled");
    const method = Object.keys(parse(readFileSync(join(cwd, "platform.yaml"), "utf8")).settings);
    expect(method).toEqual(["adf-copy"]);
    const parameters = () =>
      JSON.parse(readFileSync(join(cwd, "out/adf/parameters/prod.json"), "utf8")).parameters;
    expect(cli(cwd, ["apply", "--no-diff", "--out", join(cwd, "out")]).code).toBe(0);
    // Production triggers start by default; the fragment stops this one.
    expect(parameters().tr_erp_erp_properties_runtimeState.value).toBe("Started");
    merge(join(cwd, "platform.yaml"), fragment!);
    expect(cli(cwd, ["apply", "--no-diff", "--out", join(cwd, "out")]).code).toBe(0);
    const trigger = JSON.parse(
      readFileSync(join(cwd, "out/adf/factory/trigger/tr_erp_erp.json"), "utf8"),
    );
    expect(trigger.properties.runtimeState).toBe("Stopped");
    // Stopped everywhere, so the state no longer differs and is not a parameter.
    expect(parameters().tr_erp_erp_properties_runtimeState).toBeUndefined();
  });

  it("deploys with each environment's parameter file, in the order the CI template uses", () => {
    const deploy = section(read("platforms/adf-deploy.mdx"), "## Deploy");
    const [build] = fences(deploy, "sh");
    expect(build).toContain("@microsoft/azure-data-factory-utilities@1.0.3");
    expect(build).toContain("export build/adf/factory <dev factory resource ID> arm");
    const [steps] = fences(deploy, "powershell");
    const lines = steps!.trimEnd().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("-ArmTemplateParameters build/adf/parameters/prod.json");
    expect(lines[0]).toContain("-PreDeployment $true -DeleteDeployment $false");
    expect(lines[1]).toContain("--mode Incremental");
    expect(lines[1]).toContain('--parameters "@build/adf/parameters/prod.json" factoryName=');
    expect(lines[2]).toContain("-PreDeployment $false -DeleteDeployment $true");
  });
});

describe("platforms/adf-pipelines", () => {
  it("shows the Northwind example's standard, whose pipeline has the design the page describes", () => {
    const page = read("platforms/adf-pipelines.mdx");
    expect(page).toContain('<Example name="northwind" file="standard.yaml" pick="ingest" />');
    expect(fences(page, "yaml"), "no hand-written YAML").toEqual([]);
    const cwd = copy("northwind");
    const out = join(cwd, "out");
    const applied = cli(cwd, ["apply", "--no-diff", "--out", out]);
    expect(applied.code, applied.output).toBe(0);
    const pipeline = JSON.parse(
      readFileSync(join(out, "adf/factory/pipeline", pipelineFile(applied.output)), "utf8"),
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
    expect(run(["-bail", "ingestron.duckdb", "-c", ".read build/duckdb/dev/run.sql"]).status).toBe(
      0,
    );
    const [query] = commands(shown);
    const words = [...query!.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2]!);
    expect(words.slice(0, 3)).toEqual(["duckdb", "ingestron.duckdb", "-c"]);
    const result = run(words.slice(1));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(fences(shown, "text")[0]);
  });
});

describe("each restructured platform page's Create it", () => {
  it.each(["synapse", "landing-only", "duckdb", "duckdb-in-azure"])(
    "%s: creates a project that plans, with the page's commands",
    (page) => {
      const create = commands(section(read(`platforms/${page}.mdx`), "## Create it"));
      const init = command(create, "init");
      expect(create[1], "then into the project").toBe(`cd ${init[1]}`);
      const parent = mkdtempSync(join(tmpdir(), `docs-create-${page}-`));
      const created = cli(parent, init);
      expect(created.code, created.output).toBe(0);
      const planned = cli(join(parent, init[1]!), ["plan", "--no-diff"]);
      expect(planned.code, planned.output).toBe(0);
    },
  );
});

/** The one pipeline file a plan or apply lists. */
function pipelineFile(output: string): string {
  const found = [...output.matchAll(/create {4}factory\/pipeline\/(\S+\.json)/g)].map(
    (match) => match[1]!,
  );
  expect(found, "one generated pipeline").toHaveLength(1);
  return found[0]!;
}

describe("how-to/deploy-through-environments", () => {
  const page = read("how-to/deploy-through-environments.mdx");

  it("renders each part of a template it names, and links each platform's deploy section", () => {
    const templates = [...page.matchAll(/<Template\s([\s\S]*?)\/>/g)].map(([, props]) => ({
      file: /file="([^"]+)"/.exec(props!)![1]!,
      from: /from="([^"]+)"/.exec(props!)![1]!,
      to: /to="([^"]+)"/.exec(props!)![1]!,
    }));
    expect(templates.map((template) => template.file)).toEqual([
      "github-actions/deploy.yml",
      "github-actions/deploy-environment.yml",
      "github-actions/deploy-environment.yml",
      "azure-devops/azure-pipelines.yml",
      "azure-devops/templates/deploy-environment.yml",
    ]);
    for (const { file, from, to } of templates)
      expect(readTemplateExtract(file, from, to), `${file} › ${from}`).not.toBe("");
    for (const platform of ["adf-deploy", "databricks-deploy", "synapse", "duckdb-in-azure"]) {
      expect(page).toContain(`(/docs/platforms/${platform}#deploy)`);
      expect(section(read(`platforms/${platform}.mdx`), "### From CI")).toContain(
        "(/docs/how-to/deploy-through-environments)",
      );
    }
  });

  it("lists every variable the templates read, in their headers", () => {
    const github = readFileSync(
      join(process.cwd(), "ci-templates/github-actions/deploy-environment.yml"),
      "utf8",
    );
    const listed = section(page, "## GitHub Actions");
    // Every variable a step reads, leaving out the comments' examples.
    const code = (text: string) =>
      text
        .split("\n")
        .filter((line) => !line.trim().startsWith("#"))
        .join("\n");
    for (const [, name] of code(github).matchAll(/\$\{\{ vars\.([A-Z_]+) \}\}/g)) {
      expect(github.split("\njobs:")[0], name).toContain(name!);
    }
    expect(listed).toContain('from="# Variables to set in each GitHub environment:"');
    const devops = readFileSync(
      join(process.cwd(), "ci-templates/azure-devops/templates/deploy-environment.yml"),
      "utf8",
    );
    const header = devops.split("\nparameters:")[0]!;
    const builtIn = new Set(["Pipeline.Workspace", "Agent.TempDirectory", "files"]);
    for (const [, name] of code(devops).matchAll(/\$\(([A-Za-z_.]+)\)/g))
      if (!builtIn.has(name!)) expect(header, name).toContain(name!);
  });
});

describe("reference/versions", () => {
  it("names the tool versions the deploy templates pin", () => {
    const tools = section(read("reference/versions.mdx"), "## Deploy tools");
    const template = (file: string) =>
      readFileSync(join(process.cwd(), "ci-templates", file), "utf8");
    const github = template("github-actions/deploy-environment.yml");
    const build = template("github-actions/deploy.yml");
    const adf = /@microsoft\/azure-data-factory-utilities@([\d.]+)/.exec(build)![1]!;
    const databricks = /databricks\/setup-cli@[0-9a-f]{40} # (v[\d.]+)/.exec(github)![1]!;
    const sqlcmd = /go-sqlcmd\/releases\/download\/(v[\d.]+)\//.exec(github)![1]!;
    expect(tools).toContain(`\`@microsoft/azure-data-factory-utilities\` ${adf}`);
    expect(tools).toContain(`Databricks CLI ${databricks}`);
    expect(tools).toContain(`sqlcmd (Go) ${sqlcmd}`);
    expect(tools).toContain("`ingestron@2.2.0`");
  });
});
