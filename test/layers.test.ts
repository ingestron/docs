// The Layers concept, held to the projects it shows: each example the page
// embeds is resolved, and every table lands in the layer the page says, for
// the reason it gives.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadDefinitions, type Pack } from "@ingestron/definitions";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { DefaultLayers } from "../components/reference/pack-defaults";
import { exampleFolder } from "../lib/examples";
import { packs } from "../lib/reference";
import { copy, read, section } from "./pages.js";

const page = read("concepts/layers.mdx");

/** A project resolved for one environment with the packs its standard names. */
function resolve(folder: string, environment = "dev") {
  const standard = parse(readFileSync(join(folder, "standard.yaml"), "utf8")) as {
    packs: string[];
  };
  const named = standard.packs.map((reference) =>
    packs.find((pack) => pack.id === reference.split("@")[0])!,
  ) satisfies Pack[];
  return loadDefinitions(folder, { packs: named, environment });
}

/** The cells of a Markdown table's body rows, without their backticks. */
const rows = (text: string) =>
  text
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .slice(2)
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );

const unquoted = (cell: string) => cell.replace(/`/g, "");

describe("concepts/layers", () => {
  it("names the default layers every pack has, as DefaultLayers renders them", () => {
    const shown = renderToStaticMarkup(createElement(DefaultLayers)).replace(/<[^>]+>/g, "");
    expect(shown).toBe("bronze, silver and gold");
    for (const pack of packs) expect(pack.defaults.layers).toEqual(["bronze", "silver", "gold"]);
    expect(page.split("\n## ")[0]).toContain("<DefaultLayers />");
  });

  it("lands each table of the example in the layer its table says, for the reason it gives", () => {
    const lands = section(page, "## Where a table lands");
    const embedded = [...lands.matchAll(/<Example name="([^"]+)" file="([^"]+)" \/>/g)];
    expect(new Set(embedded.map((match) => match[1]))).toEqual(new Set(["layers-and-transforms"]));
    const result = resolve(exampleFolder("layers-and-transforms"));
    expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    const model = result.model!;
    expect(model.layers).toEqual(["bronze", "silver", "gold"]);

    const table = rows(lands);
    expect(table.map((row) => unquoted(row[0]!))).toEqual(model.tables.map((item) => item.name));
    for (const [name, madeBy, layer, why] of table) {
      const found = model.tables.find((item) => item.name === unquoted(name!))!;
      expect(found.layer, name).toBe(unquoted(layer!));
      // A flow table names its flow; a transform's table is the transform.
      const [kind, id] = unquoted(madeBy!).split(" ");
      expect(found.origin.kind.toLowerCase(), name).toBe(kind);
      expect(found.origin.id, name).toBe(id);
      // The reason: a layer the definition names, or the list's first or second.
      const definition = parse(
        readFileSync(join(exampleFolder("layers-and-transforms"), found.origin.file), "utf8"),
      ) as { layer?: string };
      if (definition.layer) expect(why, name).toContain(`\`layer: ${definition.layer}\``);
      else expect(why, name).toContain(kind === "flow" ? "the first" : "the second");
      expect(found.layer).toBe(definition.layer ?? model.layers[kind === "flow" ? 0 : 1]);
    }
  });

  it("gives the names, file and gold settings the page describes", () => {
    const changes = section(page, "## What a layer changes");
    const model = resolve(exampleFolder("layers-and-transforms")).model!;
    const table = (name: string) => model.tables.find((item) => item.name === name)!;
    const { catalog, schema, table: name } = table("store_sales").fullName;
    expect(changes).toContain(`\`\` \`${catalog}\`.\`${schema}\`.\`${name}\` \`\``);
    expect(changes).toContain("`build/databricks/src/sales/silver/store_sales.sql`");
    expect(
      readFileSync(join(exampleFolder("layers-and-transforms"), "README.md"), "utf8"),
    ).toContain("build/databricks/src/sales/silver/store_sales.sql");
    expect(changes).toContain('<Example name="layers-and-transforms" file="standard.yaml" />');
    // Only the gold table is chosen by the standard's rule, with its settings.
    const gold = model.tables.filter((item) => item.layer === "gold");
    expect(gold.map((item) => item.name)).toEqual(["region_sales"]);
    expect(table("region_sales").store?.chosenBy).toMatchObject({
      by: "standard-rule",
      when: { layer: "gold" },
    });
    const retention = { "delta.logRetentionDuration": "interval 90 days" };
    expect(table("region_sales").store?.settings.properties).toEqual(retention);
    expect(table("store_sales").store?.chosenBy.by).not.toBe("standard-rule");
    expect(table("store_sales").store?.settings.properties).not.toEqual(retention);
  });

  it("replaces the list with a standard's own layers, so the default ones no longer exist", () => {
    const own = section(page, "## Name your own layers");
    const written = /`layers: \[([^\]]+)\]`/.exec(own)![1]!.split(", ");
    const folder = exampleFolder("standards-and-conventions");
    const standard = parse(readFileSync(join(folder, "standard.yaml"), "utf8"));
    expect(standard.layers).toEqual(written);
    const model = resolve(folder).model!;
    expect(model.layers).toEqual(written);
    expect(own).toContain(`land in \`${written[0]}\`, the`);
    for (const item of model.tables) expect(item.layer, item.name).toBe(written[0]);

    // A flow that names a default layer the list replaced.
    const cwd = copy("standards-and-conventions");
    const flow = join(cwd, "flows/web.yaml");
    writeFileSync(
      flow,
      readFileSync(flow, "utf8").replace(/^source: web$/m, "source: web\nlayer: bronze"),
    );
    expect(own).toContain("`layer: bronze` is `UNKNOWN_LAYER`");
    expect(resolve(cwd).diagnostics.map((item) => item.code)).toContain("UNKNOWN_LAYER");
  });
});
