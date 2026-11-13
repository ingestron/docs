// Source metadata, as the site documents it: the recipes page lists exactly the
// recipes installed with Ingestron, each with its inputs, defaults and
// documentation; connector pages show the recipe their connections use; and the
// CLI, document and error references pick up the source metadata features from
// the code, with no copy written by hand.
import { readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { commands, flags } from "@ingestron/cli";
import { installedSourceRecipes } from "@ingestron/core";
import { codeHelp, loadingCodeHelp, documentReference } from "@ingestron/definitions";
import { ConnectorPage } from "../components/reference/connector-page";
import { CliCommands } from "../components/reference/cli-commands";
import { ErrorCodes, LoadingCodes } from "../components/reference/error-codes";
import { FieldTable } from "../components/reference/document-fields";
import { RecipeCatalog, RecipeList, RecipePlaceholders } from "../components/reference/recipes";
import { connectorIds } from "../lib/reference.js";
import {
  connectorRecipes,
  howBlocks,
  placeholdersUsed,
  recipesFolder,
  recipes,
  recipesThatFit,
  reservedPlaceholders,
} from "../lib/recipes.js";
import { anchors, read } from "./pages.js";

// The code blocks render asynchronously in the site; here each shows its code.
vi.mock("fumadocs-ui/components/codeblock.rsc", () => ({
  ServerCodeBlock: ({ code }: { code: string }) => createElement("pre", null, code),
}));
vi.mock("@/components/example", () => ({
  Example: ({ name, file }: { name: string; file: string }) =>
    createElement("pre", { "data-example": `${name}/${file}` }),
}));
vi.setConfig({ testTimeout: 30_000 });

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
/** What a page shows for text: the characters HTML escapes, escaped. */
const escaped = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");

describe("the recipes page", () => {
  it("lists exactly the recipes the catalogue installs", () => {
    const catalogue = installedSourceRecipes(recipesFolder).map((recipe) => recipe.id);
    const files = readdirSync(recipesFolder)
      .filter((name) => name.endsWith(".yaml"))
      .map((name) => name.replace(/\.yaml$/, ""))
      .sort();
    expect(recipes().map((recipe) => recipe.id)).toEqual(catalogue);
    expect(catalogue).toEqual(files);
    expect(catalogue).toHaveLength(11);
    expect(catalogue).not.toContain("servicenow");
    const shown = html(createElement(RecipeCatalog));
    expect([...shown.matchAll(/<h3 id="([^"]+)"/g)].map((match) => match[1])).toEqual(catalogue);
    const listed = html(createElement(RecipeList));
    expect(
      [...listed.matchAll(/href="\/docs\/reference\/recipes#([^"]+)"/g)].map((match) => match[1]),
    ).toEqual(catalogue);
  });

  it("shows each recipe's who, access, step, save path, inputs with defaults and documentation", () => {
    const shown = html(createElement(RecipeCatalog));
    for (const recipe of recipes()) {
      for (const text of [recipe.title, recipe.ask.who, recipe.ask.access, recipe.ask.save])
        expect(shown, recipe.id).toContain(escaped(text));
      const step = recipe.ask.run ?? recipe.ask.call;
      if (step) expect(shown, recipe.id).toContain(escaped(step.trimEnd()));
      for (const [name, input] of Object.entries(recipe.inputs)) {
        expect(shown, `${recipe.id}: ${name}`).toContain(`<code>${name}</code>`);
        expect(shown, `${recipe.id}: ${name}`).toContain(escaped(input.description));
        if (input.default !== undefined) expect(shown).toContain(escaped(input.default));
      }
      for (const source of recipe.sources) {
        expect(shown, recipe.id).toContain(`href="${escaped(source.url)}"`);
        expect(shown, recipe.id).toContain(`(read ${source.read})`);
      }
    }
  });

  it("explains every placeholder the recipes write, from the catalogue", () => {
    const used = placeholdersUsed();
    expect(used.size).toBeGreaterThan(3);
    for (const [name, ids] of used)
      for (const id of ids)
        expect(
          name in reservedPlaceholders ||
            name in recipes().find((recipe) => recipe.id === id)!.inputs,
          `{${name}} in ${id}`,
        ).toBe(true);
    const shown = html(createElement(RecipePlaceholders));
    for (const name of Object.keys(reservedPlaceholders))
      expect(shown.includes(`{${name}}`), name).toBe(used.has(name));
    expect(read("reference/recipes.mdx")).toContain("<RecipePlaceholders />");
  });

  it('shows "None" for a recipe that is no connector\'s default', () => {
    const listed = html(createElement(RecipeList));
    const row = (id: string) => listed.split("<tr>").find((part) => part.includes(`#${id}"`))!;
    expect(row("mysql")).toMatch(/<td>None<\/td><\/tr>/);
    expect(row("sqlserver")).toContain('href="/docs/connectors/sqlserver"');
  });

  it("splits a recipe's instructions into paragraphs and commands", () => {
    const blocks = howBlocks("Save it.\nThen run:\n\n    curl one\n    curl two\n\nDone.");
    expect(blocks).toEqual([
      { command: false, text: "Save it. Then run:" },
      { command: true, text: "curl one\ncurl two" },
      { command: false, text: "Done." },
    ]);
  });

  it("is a page of the Reference area, in the contents and in the URLs", () => {
    const page = read("reference/recipes.mdx");
    expect(page).toContain("<RecipeList />");
    expect(page).toContain("<RecipeCatalog />");
    expect(read("reference/meta.json")).toContain('"recipes"');
    // A link to a field's row, such as `#connection-metadata`, is checked with the documents.
    for (const link of page.matchAll(/\]\((\/docs\/reference\/[a-z-]+)#([^)]+)\)/g)) {
      if (link[2]!.startsWith("connection-")) continue;
      const target = link[1]!.replace("/docs/", "");
      expect([...anchors(read(`${target}.mdx`)).keys()], link[0]).toContain(link[2]!);
    }
  });
});

describe("connector pages", () => {
  it("show the recipe a connector uses by default, and one that has its id", () => {
    const byConnector = Object.fromEntries(
      connectorIds().map((id) => [
        id,
        connectorRecipes(id).map((item) => `${item.recipe.id}:${item.how}`),
      ]),
    );
    expect(byConnector.sqlserver).toEqual(["sqlserver:default"]);
    expect(byConnector.salesforce).toEqual(["salesforce:default"]);
    expect(byConnector.kafka).toEqual(["schema-registry:default"]);
    expect(byConnector.files).toEqual(["sample:default"]);
    expect(byConnector.mysql).toEqual(["mysql:named"]);
    expect(byConnector.rest).toEqual(["openapi:fits"]);
    expect(byConnector["dynamics-365"]).toEqual(["dataverse:fits"]);
    expect(byConnector.odata).toEqual(["odata:named"]);
    expect(byConnector["sap-ecc"]).toEqual(["sap-odata:fits"]);
    expect(byConnector["sap-table"]).toEqual([]);
    for (const id of ["sqlserver", "mysql", "files", "rest"]) {
      const page = html(createElement(ConnectorPage, { id }));
      expect(page, id).toContain('<h2 id="source-metadata"');
      expect(page.indexOf('id="source-metadata"'), id).toBeLessThan(page.indexOf('id="examples"'));
    }
    expect(html(createElement(ConnectorPage, { id: "sap-table" }))).not.toContain(
      "source-metadata",
    );
    expect(html(createElement(ConnectorPage, { id: "rest" }))).toContain(
      "If the source is one the",
    );
  });

  it("point only from connectors that exist to recipes that are installed", () => {
    const ids = recipes().map((recipe) => recipe.id);
    for (const [connector, fitting] of Object.entries(recipesThatFit)) {
      expect(connectorIds(), connector).toContain(connector);
      for (const id of fitting) expect(ids, `${connector}: ${id}`).toContain(id);
    }
  });
});

describe("the references", () => {
  it("list the source and assistant commands and their options from the CLI", () => {
    const names = commands.map((command) => command.name);
    for (const name of ["source", "assistant"]) expect(names).toContain(name);
    const shown = html(createElement(CliCommands));
    for (const { name } of commands) expect(shown).toContain(`<code>ingestron ${name}</code>`);
    const options = flags.map((flag) => flag.flag);
    for (const flag of [
      "--from-metadata",
      "--needed",
      "--dry-run",
      "--object",
      "--connection",
      "--assistant",
    ])
      expect(
        options.some((option) => option.startsWith(flag)),
        flag,
      ).toBe(true);
    for (const { flag } of flags) expect(shown).toContain(`<code>${escaped(flag)}</code>`);
    expect(read("reference/cli.mdx")).toContain("## Source metadata [#source-metadata]");
  });

  it("give every field of a SourceMetadata document and a connection's metadata its anchor", () => {
    const page = read("reference/documents.mdx");
    expect(page).toContain('<DocumentFields kind="SourceMetadata" />');
    expect(page).toContain('<DocumentFields kind="Connection" />');
    const fields = [
      ...documentReference("SourceMetadata"),
      ...documentReference("Connection").filter((field) => field.path[0] === "metadata"),
    ];
    expect(fields.length).toBeGreaterThan(20);
    const shown = html(createElement(FieldTable, { label: "x", fields }));
    for (const field of fields) {
      const [path, anchor] = field.docs.split("#");
      expect(path).toBe("/docs/reference/documents");
      expect(shown).toContain(`id="${anchor}"`);
    }
  });

  it("explain every code the definitions report, the source metadata ones included", () => {
    const shown = html(createElement(ErrorCodes)) + html(createElement(LoadingCodes));
    const codes = Object.keys({ ...codeHelp, ...loadingCodeHelp });
    for (const code of codes) expect(shown, code).toContain(`id="${code}"`);
    const source = codes.filter((code) => code.startsWith("SOURCE_"));
    expect(source.length).toBeGreaterThanOrEqual(8);
    for (const code of [...source, "CONTRACT_NEEDED", "TABLE_NO_COLUMNS"]) {
      expect(codes).toContain(code);
      const entry = shown.slice(shown.indexOf(`id="${code}"`));
      expect(entry.slice(0, entry.indexOf("</section>"))).toContain("<strong>Fix:</strong>");
    }
  });
});
