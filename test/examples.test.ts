// The worked examples: front matter for listing, and safe reads of their files.
import { describe, expect, it } from "vitest";
import { appendFileSync, cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@ingestron/cli";
import { exampleFiles, exampleFolder, listExamples, readExampleFile } from "../lib/examples.js";
import { connectorExample, watermarkExample } from "../lib/connector-page.js";
import { connectorEntries, connectorIds } from "../lib/reference.js";
import { contentFile, contentFolder } from "../lib/content-files.js";

describe("examples", () => {
  it("includes every connector example preview in its downloadable archive", () => {
    const archives = new Map(
      listExamples().map((example) => [example.name, exampleFiles(example.name)]),
    );
    const shown: [string, string, string][] = [
      ["adf-copy pages", watermarkExample, "standard.yaml"],
      ["adf-copy pages", watermarkExample, "flows/erp.yaml"],
    ];
    for (const id of connectorIds()) {
      for (const { pack } of connectorEntries(id)) {
        const { connection, flow } = connectorExample(id, pack);
        shown.push([id, connection.name, connection.file], [id, flow.name, flow.file]);
      }
      // The examples a connector's own notes show.
      const page = readFileSync(
        join(process.cwd(), "content/docs/connectors", `${id}.mdx`),
        "utf8",
      );
      for (const [, name, file] of page.matchAll(/<Example name="([^"]+)" file="([^"]+)"/g))
        shown.push([id, name!, file!]);
    }
    for (const [where, name, file] of shown)
      expect(archives.get(name), `${where}: ${name}/${file}`).toContain(file);
    expect(shown.filter(([where]) => where === "files").length).toBeGreaterThan(4);
    // Reads every connector's page and every example archive.
  }, 30_000);
  it("lists every sample with a title, summary and the facts found by resolving it", () => {
    const examples = listExamples();
    expect(examples).toHaveLength(26);
    for (const example of examples) {
      expect(example.title, example.name).not.toBe("");
      expect(example.summary, example.name).toMatch(/\.$/);
      expect(example.facts.packs.length, example.name).toBeGreaterThan(0);
    }
  });

  it("keeps an empty folder the example needs, such as DuckDB's published folder", () => {
    const files = exampleFiles("duckdb-local");
    expect(files).toContain("published/.gitkeep");
    expect(files.filter((file) => file.split("/").some((part) => part.startsWith(".")))).toEqual([
      "published/.gitkeep",
    ]);
  });

  it("reads a real file", () => {
    expect(readExampleFile("minimal", "project.yaml")).toContain("environments");
  });

  it("generates a sample's output to show a generated file", () => {
    expect(readExampleFile("minimal", "build/databricks/databricks.yml")).toContain("bundle:");
  });

  it("names the example and file when a generated file is missing", () => {
    expect(() => readExampleFile("minimal", "build/databricks/nope.yml")).toThrow(
      'Example "minimal" has no file "build/databricks/nope.yml".',
    );
  });

  it("names the example and file when the file is missing", () => {
    expect(() => readExampleFile("minimal", "nope.yaml")).toThrow(
      'Example "minimal" has no file "nope.yaml".',
    );
  });

  it("refuses a path outside the example", () => {
    expect(() => readExampleFile("minimal", "../../guides/environments/project.yaml")).toThrow(
      'Example "minimal": "../../guides/environments/project.yaml" is outside the example.',
    );
  });

  it("fails the standard's break-a-rule exercise with the output its page shows", () => {
    const cwd = mkdtempSync(join(tmpdir(), "docs-fixed-setting-"));
    cpSync(exampleFolder("standards-and-conventions"), cwd, { recursive: true });
    appendFileSync(
      join(cwd, "flows/web.yaml"),
      readExampleFile("standards-and-conventions", "exercises/fixed-setting.yaml"),
    );
    const page = readFileSync(
      join(contentFolder, contentFile("how-to/configure-a-standard.mdx")),
      "utf8",
    );
    // "Plan again:", the command the page shows, then what it prints.
    const [, command, shown] =
      /Plan again:\n\n```sh\ningestron (.*)\n```\n\n```text\n([\s\S]*?)```/.exec(page) ?? [];
    expect(command, "the plan command after Plan again").toBe("plan");
    let output = "";
    expect(run(command!.split(" "), { cwd, write: (text) => (output += text) })).toBe(1);
    expect(output).toBe(shown);
  });
});
