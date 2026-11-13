// Source metadata recipes, from the installed @ingestron/standards package:
// how to get one kind of source's tables, columns and types, so each recipe's
// section shows the recipe's own query or call, inputs and documentation.
import { join } from "node:path";
import { installedSourceRecipes, sourceOrigin, type SourceRecipe } from "@ingestron/core";

/** The `recipes` folder of the installed @ingestron/standards package. */
export const recipesFolder = join(process.cwd(), "node_modules/@ingestron/standards/recipes");

let found: SourceRecipe[] | undefined;

/** Every installed recipe, by id in code point order. */
export function recipes(): SourceRecipe[] {
  found ??= installedSourceRecipes(recipesFolder);
  return found;
}

/** One installed recipe. */
export function recipeById(id: string): SourceRecipe {
  const recipe = recipes().find((item) => item.id === id);
  if (!recipe) throw new Error(`No recipe "${id}" is installed.`);
  return recipe;
}

/** A recipe's anchor on the recipes page, such as `/docs/reference/recipes#sqlserver`. */
export function recipePage(id: string): string {
  return `/docs/reference/recipes#${id}`;
}

/**
 * How a connector comes to use a recipe: by default, because a connection names it, or because
 * the recipe fits a source the connector reads.
 */
export interface ConnectorRecipe {
  recipe: SourceRecipe;
  /**
   * `default`: a connection with no `metadata` uses it; `named`: the recipe has the connector's
   * id and a connection writes `metadata.from`; `fits`: the same, for a recipe of another id.
   */
  how: "default" | "named" | "fits";
}

/**
 * Recipes that fit a connector's sources though they carry another id: the connectors read the
 * kind of source the recipe asks about. This is the one place that says so; `sourceOrigin` knows
 * only the defaults.
 */
export const recipesThatFit: Readonly<Record<string, readonly string[]>> = {
  "dynamics-365": ["dataverse"],
  rest: ["openapi"],
  // The ADF SAP ECC connector reads OData services that SAP Gateway exposes: its linked service
  // takes the service URL (https://learn.microsoft.com/en-us/azure/data-factory/connector-sap-ecc,
  // read 2026-11-13).
  "sap-ecc": ["sap-odata"],
};

/**
 * The recipes a connector's page shows: the one a connection with no `metadata` uses, a recipe
 * that has the connector's id, and the recipes that fit its sources (written as `metadata.from`).
 */
export function connectorRecipes(connector: string): ConnectorRecipe[] {
  const all = new Map(recipes().map((recipe) => [recipe.id, recipe]));
  const byDefault = sourceOrigin({ id: "connection", connector }, all).recipe;
  const named = all.get(connector);
  return [
    ...(byDefault ? [{ recipe: byDefault, how: "default" as const }] : []),
    ...(named && named !== byDefault ? [{ recipe: named, how: "named" as const }] : []),
    ...(recipesThatFit[connector] ?? []).flatMap((id) => {
      const recipe = all.get(id);
      return recipe && recipe !== byDefault && recipe !== named
        ? [{ recipe, how: "fits" as const }]
        : [];
    }),
  ];
}

/**
 * What the request fills in where a recipe writes `{name}`, besides the recipe's own inputs
 * (specification, "Placeholders").
 */
export const reservedPlaceholders: Readonly<Record<string, string>> = {
  connection: "the connection's id",
  object:
    "one table's `object`, as its flow writes it; a step that holds it is written once for each table",
  schemas: "the schemas the connection's flow tables read, each in single quotes",
};

/**
 * Every `{name}` the installed recipes write in their text, with the recipes that write it. A
 * name that is neither reserved nor an input of its recipe would be left as written by the
 * request, so a test pins that there is none.
 */
export function placeholdersUsed(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const recipe of recipes()) {
    const { who, access, run, call, save, how } = recipe.ask;
    const text = [who, access, run, call, save, how]
      .filter((item) => item !== undefined)
      .join("\n");
    for (const [, name] of text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g))
      found.set(name!, [...new Set([...(found.get(name!) ?? []), recipe.id])]);
  }
  return found;
}

/** What a recipe's kind means, in words. */
export const kindWords: Record<SourceRecipe["kind"], string> = {
  catalog: "A query or call on the source's own catalogue",
  document: "A document the source publishes",
  sample: "A file of what the source sends",
};

/** What each reader reads. */
export const readerWords: Record<SourceRecipe["read"], string> = {
  columns: "A columns file: one row for each column",
  sample: "A sample file: CSV, JSON, JSON lines or Parquet",
  odcs: "An ODCS data contract",
  odata: "An OData metadata document",
  openapi: "An OpenAPI description",
  "json-schema": "A JSON Schema",
  avro: "An Avro schema",
  "salesforce-describe": "A Salesforce object description",
};

/**
 * The paragraphs and indented commands of a recipe's `how`, in order. A block indented four
 * spaces is a command; any other block is a paragraph.
 */
export function howBlocks(how: string): { command: boolean; text: string }[] {
  return how
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n");
      const command = lines.every((line) => line.startsWith("    "));
      return {
        command,
        text: command
          ? lines.map((line) => line.slice(4)).join("\n")
          : lines.map((line) => line.trim()).join(" "),
      };
    });
}
