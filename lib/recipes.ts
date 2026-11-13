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

/** How a connector comes to use a recipe: by default, or because a connection names it. */
export interface ConnectorRecipe {
  recipe: SourceRecipe;
  /** `default`: a connection with no `metadata` uses it; `named`: the connection writes `metadata.from`. */
  how: "default" | "named";
}

/**
 * The recipes a connector's page shows: the one a connection with no `metadata` uses, and a
 * recipe that has the connector's id (written as `metadata.from`).
 */
export function connectorRecipes(connector: string): ConnectorRecipe[] {
  const all = new Map(recipes().map((recipe) => [recipe.id, recipe]));
  const byDefault = sourceOrigin({ id: "connection", connector }, all).recipe;
  const named = all.get(connector);
  return [
    ...(byDefault ? [{ recipe: byDefault, how: "default" as const }] : []),
    ...(named && named !== byDefault ? [{ recipe: named, how: "named" as const }] : []),
  ];
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
