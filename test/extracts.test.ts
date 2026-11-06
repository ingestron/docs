// Parts of a sample's files (components/example.tsx): a YAML or JSON path, the
// lines between two markers, a generated folder's listing and the platform
// request, and the lines of a template in ci-templates/, each read from the sample so it cannot drift, and each failing the
// build, with the sample, file and path named, when it is not there.
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { BuildTree, Example, Request, Template } from "../components/example";
import { pathParts, pickLines, pickPath } from "../lib/extract";
import {
  exampleRequest,
  exampleTree,
  readExampleExtract,
  readExampleFile,
  readTemplateExtract,
  requestSections,
} from "../lib/examples";

const yaml = `# A comment
targets:
  dev:
    mode: development # inline
  prod:
    mode: production
tables:
  - name: orders
    mode: append
  - name: customers
`;
/** The block a component shows: its code, kind, title and frame name. Highlighting is async, so tests read the props. */
const block = (element: ReactElement) =>
  element.props as { code: string; lang: string; kind: string; title?: string; label: string };

const json = `{
\t"properties": {
\t\t"activities": [
\t\t\t{
\t\t\t\t"name": "copy",
\t\t\t\t"policy": { "retry": 2 }
\t\t\t},
\t\t\t{ "name": "wait" }
\t\t]
\t}
}`;

describe("a path into a YAML or JSON file", () => {
  it("reads keys, indexes and quoted keys", () => {
    expect(pathParts("properties.activities[0].name")).toEqual([
      "properties",
      "activities",
      0,
      "name",
    ]);
    expect(pathParts('resources["retail.refresh"].schedule')).toEqual([
      "resources",
      "retail.refresh",
      "schedule",
    ]);
    for (const bad of ["", "a.", ".a", "a..b", "a[x]", "a]"])
      expect(() => pathParts(bad), bad).toThrow(/is not a path/);
  });

  it("shows a YAML key with its value, indented as in the file", () => {
    expect(pickPath(yaml, "targets.prod")).toBe("  prod:\n    mode: production");
    expect(pickPath(yaml, "targets.dev.mode")).toBe("    mode: development");
    expect(pickPath(yaml, "tables[1]")).toBe("  - name: customers");
    // A key that opens a list item keeps its place, without the dash.
    expect(pickPath(yaml, "tables[0].name")).toBe("    name: orders");
    expect(pickPath("packs: [databricks@1, adf@1]", "packs[1]")).toBe(`${" ".repeat(22)}adf@1`);
  });

  it("shows a JSON member or item as generated, tabs and all", () => {
    expect(pickPath(json, "properties.activities[0]")).toBe(
      '\t\t\t{\n\t\t\t\t"name": "copy",\n\t\t\t\t"policy": { "retry": 2 }\n\t\t\t}',
    );
    expect(pickPath(json, "properties.activities[0].policy")).toBe(
      '\t\t\t\t"policy": { "retry": 2 }',
    );
    expect(pickPath(json, "properties.activities[1].name")).toBe('\t\t\t  "name": "wait"');
    // An item of a one-line list keeps its column, without what precedes it.
    expect(pickPath('{\n\t"items": [1, {"a": 2}]\n}', "items[1]")).toBe(
      `\t${" ".repeat(13)}{"a": 2}`,
    );
  });

  it("finds nothing at a path the file does not have", () => {
    expect(pickPath(yaml, "targets.test")).toBeUndefined();
    expect(pickPath(yaml, "tables[2]")).toBeUndefined();
    expect(pickPath(yaml, "targets[0]")).toBeUndefined();
    expect(pickPath(json, "properties.activities.name")).toBeUndefined();
  });
});

describe("the lines between two markers", () => {
  const sql = "-- views\nCREATE VIEW a AS\nSELECT 1\nGO\nCREATE VIEW b AS SELECT 2;\nGO\n";

  it("runs from the first line holding one to the next holding the other", () => {
    expect(pickLines(sql, "CREATE VIEW a", "GO")).toEqual({
      lines: "CREATE VIEW a AS\nSELECT 1\nGO",
    });
    expect(pickLines(sql, "VIEW b", ";")).toEqual({ lines: "CREATE VIEW b AS SELECT 2;" });
  });

  it("names the marker no line holds", () => {
    expect(pickLines(sql, "CREATE VIEW c", "GO")).toEqual({ missing: "CREATE VIEW c" });
    expect(pickLines(sql, "VIEW b", "END")).toEqual({ missing: "END" });
  });
});

describe("an extract of a sample's file", () => {
  const file = "build/adf/factory/pipeline/pl_northwind_northwind.json";

  it("shows part of a generated file as Ingestron wrote it", () => {
    const whole = readExampleFile("northwind", file);
    const part = readExampleExtract("northwind", file, {
      pick: "properties.activities[0].typeProperties.batchCount",
    });
    expect(part).toBe('\t\t\t\t\t"batchCount": 4');
    expect(whole).toContain(part);
    const sql = readExampleExtract(
      "northwind",
      "build/databricks/src/northwind/silver/daily_sales.sql",
      {
        from: "SELECT",
        to: "GROUP BY",
      },
    );
    expect(sql).toMatch(/^SELECT CAST\(o.order_date AS DATE\)[\s\S]*GROUP BY .*;$/);
  });

  it("fails with the sample, file and path or marker named", () => {
    expect(() => readExampleExtract("northwind", file, { pick: "properties.nope" })).toThrow(
      `Example "northwind": "${file}" has no path "properties.nope".`,
    );
    expect(() => readExampleExtract("northwind", file, { from: "NOPE", to: "}" })).toThrow(
      `Example "northwind": "${file}" has no line containing "NOPE".`,
    );
    expect(() =>
      readExampleExtract("northwind", file, { from: '"name": "pl_northwind', to: "NOPE" }),
    ).toThrow(`Example "northwind": "${file}" has no line containing "NOPE" after`);
    expect(() =>
      readExampleExtract("northwind", "build/databricks/src/northwind/silver/daily_sales.sql", {
        pick: "a",
      }),
    ).toThrow(
      'Example "northwind": "build/databricks/src/northwind/silver/daily_sales.sql" cannot be read for pick "a": the file does not parse: Implicit keys need to be on a single line at line 2, column 1.',
    );
    expect(() => readExampleExtract("northwind", "build/adf/nope.json", { pick: "a" })).toThrow(
      'Example "northwind" has no file "build/adf/nope.json".',
    );
  });

  it("titles the block with the file and the part", () => {
    const shown = block(Example({ name: "northwind", file, pick: "properties.parameters" }));
    expect(shown).toMatchObject({
      title: `${file} › properties.parameters`,
      kind: "writes",
      lang: "json",
      label: `northwind/${file} › properties.parameters`,
    });
    expect(shown.code).toMatch(/^\t\t"parameters": \{/);
    const lines = block(
      Example({
        name: "northwind",
        file: "build/databricks/src/northwind/silver/daily_sales.sql",
        from: "SELECT",
        to: "GROUP BY",
      }),
    );
    expect(lines.title).toBe("build/databricks/src/northwind/silver/daily_sales.sql › SELECT");
    // A whole file keeps its plain title.
    expect(block(Example({ name: "northwind", file: "project.yaml" }))).toMatchObject({
      title: "project.yaml",
      kind: "write",
      lang: "yaml",
    });
  });

  it("refuses a pick with markers, or one marker alone", () => {
    const render = (props: Record<string, string>) =>
      Example({ name: "northwind", file, ...props });
    expect(() => render({ pick: "a", from: "b", to: "c" })).toThrow(/not both/);
    expect(() => render({ from: "b" })).toThrow(/from and to together/);
    expect(() => render({ to: "c" })).toThrow(/from and to together/);
  });
});

describe("a generated folder's listing", () => {
  it("lists folders first, then files, as Ingestron prints them", () => {
    expect(exampleTree("northwind", "build/adf")).toBe(
      [
        "build/adf/",
        "  factory/",
        "    dataset/",
        "      ds_northwind_landing.json",
        "      ds_northwind_northwind_northwind.json",
        "    integrationRuntime/",
        "      ir-northwind.json",
        "    linkedService/",
        "      ls_northwind_keyvault.json",
        "      ls_northwind_landing.json",
        "      ls_northwind_northwind_northwind.json",
        "    pipeline/",
        "      pl_northwind_northwind.json",
        "    trigger/",
        "      tr_northwind_northwind.json",
        "    arm-template-parameters-definition.json",
        "  parameters/",
        "    dev.json",
      ].join("\n"),
    );
    const tree = block(BuildTree({ name: "northwind", folder: "build/databricks" }));
    expect(tree.kind).toBe("prints");
    expect(tree.code).toContain("\n  resources/\n    northwind.pipeline.yml\n");
    expect(tree.code).not.toContain(".generated.json");
  });

  it("fails for a folder the sample does not generate", () => {
    expect(() => exampleTree("northwind", "build/synapse")).toThrow(
      'Example "northwind" generates no folder "build/synapse".',
    );
    expect(() => exampleTree("northwind", "contracts")).toThrow(/not a generated folder/);
    expect(() => exampleTree("northwind", "build/../..")).toThrow(/generates no folder/);
  });
});

describe("the platform request", () => {
  it("is what ingestron request prints for the sample", () => {
    const request = exampleRequest("landing-only");
    expect(request).toMatch(/^# Platform request: sales \(dev\)\n/);
    expect(request).toContain("## ADF prerequisites");
  });

  it("shows the named sections, each with its heading, in the order asked for", () => {
    const shown = requestSections("synapse-views", "dev", ["Report users", "Schedules"]);
    expect(shown).toMatch(/^## Report users\n\n- In `sales_dev`/);
    expect(shown).toContain("\n\n## Schedules\n\n- Data Factory trigger `tr_sales_erp`");
    expect(shown).not.toContain("## ADF prerequisites");
    const request = block(Request({ name: "duckdb-local", sections: ["DuckDB job"] }));
    expect(request.kind).toBe("prints");
    expect(request.code).toMatch(/^## DuckDB job\n\n- A Container Apps job running `ghcr.io/);
    expect(block(Request({ name: "minimal" })).code).toBe(exampleRequest("minimal"));
  });

  it("fails with the request's output when the request fails", () => {
    expect(() => exampleRequest("landing-only", "nope")).toThrow(
      'Example "landing-only": the request for nope fails:\n# Platform request (nope)\n\nThe definitions have problems; fix them first.\n',
    );
  });

  it("fails for a section the request does not have, naming those it has", () => {
    expect(() => requestSections("minimal", "dev", ["DuckDB job"])).toThrow(
      'Example "minimal": the request for dev has no section "DuckDB job". It has: Values to replace, Must exist before deploying, Schedules.',
    );
    expect(() => Request({ name: "minimal", sections: [] })).toThrow(/name a section/);
  });
});

describe("part of a template in ci-templates", () => {
  it("shows the lines between two markers, titled with the file and the first marker", () => {
    const shown = readTemplateExtract("azure/duckdb-job.bicep", "param name", "param memory");
    expect(shown.split("\n")[0]).toBe("param name string");
    expect(shown.trimEnd().split("\n").at(-1)).toBe("param memory string = '1Gi'");
    const props = block(
      Template({ file: "azure/duckdb-job.bicep", from: "param name", to: "param memory" }),
    );
    expect(props.code).toBe(shown.trimEnd());
    expect(props.lang).toBe("bicep");
    expect(props.kind).toBe("write");
    expect(props.title).toBe("ci-templates/azure/duckdb-job.bicep › param name");
  });

  it("fails with the file and the marker named", () => {
    expect(() => readTemplateExtract("azure/nope.bicep", "a", "b")).toThrow(
      'Template: ci-templates has no file "azure/nope.bicep".',
    );
    expect(() => readTemplateExtract("../package.json", "a", "b")).toThrow(
      'Template: ci-templates has no file "../package.json".',
    );
    expect(() => readTemplateExtract("azure/duckdb-job.bicep", "param nope", "x")).toThrow(
      'Template: "azure/duckdb-job.bicep" has no line containing "param nope".',
    );
    expect(() =>
      readTemplateExtract("azure/duckdb-job.bicep", "param name", "no such line"),
    ).toThrow(
      'Template: "azure/duckdb-job.bicep" has no line containing "no such line" after "param name".',
    );
  });
});
