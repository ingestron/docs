// Each connector is one page at its old overview URL: a short MDX file that
// renders <ConnectorPage> and holds only that connector's own notes. The old
// chapters and category pages are gone, and the sidebar lists every page once.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectSources } from "@ingestron/cli";
import { expect, it } from "vitest";
import { parse } from "yaml";
import { connectorEntries, connectorIds } from "../lib/reference.js";

const root = join(process.cwd(), "content/docs/connectors");
const meta = JSON.parse(readFileSync(join(root, "meta.json"), "utf8")) as { pages: string[] };

for (const id of connectorIds()) {
  it(`${id} is one page at /docs/connectors/${id}, rendered from metadata`, () => {
    expect(existsSync(join(root, id)), `no chapter folder for ${id}`).toBe(false);
    const text = readFileSync(join(root, `${id}.mdx`), "utf8");
    const [, front = "", body = ""] = text.split("---\n");
    const { title, description } = parse(front) as { title: string; description: string };
    expect(title).toBe(connectorEntries(id)[0]!.connector.title);
    expect(description, id).toMatch(/\.$/);
    // Below the front matter, only the component and its notes: no hand-written facts.
    expect(body.trim().startsWith(`<ConnectorPage id="${id}"`), id).toBe(true);
    const outside = body
      .replace(/<ConnectorNote at="[^"]+">[\s\S]*?<\/ConnectorNote>/g, "")
      .replace(/<\/?ConnectorPage[^>]*>/g, "")
      .trim();
    expect(outside, `${id}: text outside a note`).toBe("");
    for (const component of [
      "ConnectorFacts",
      "ConnectorSettings",
      "ExamplesList",
      "SettingsSections",
    ])
      expect(body, `${id} renders ${component} through ConnectorPage`).not.toContain(
        `<${component}`,
      );
    expect(
      meta.pages.filter((page) => page === id),
      `${id} in the sidebar once`,
    ).toHaveLength(1);
  });
}

it("has no page left from the chapters or the category pages", () => {
  const files = readdirSync(root);
  expect(files.filter((file) => !file.endsWith(".mdx") && file !== "meta.json")).toEqual([]);
  expect(files.filter((file) => file.endsWith(".mdx")).sort()).toEqual(
    ["index.mdx", ...connectorIds().map((id) => `${id}.mdx`)].sort(),
  );
});

it("lists the connectors under their categories' separators, with no category pages", () => {
  const separators = meta.pages.filter((page) => /^---.*---$/.test(page));
  const categories = [...new Set(projectSources().map((source) => source.category))];
  expect(separators.map((page) => page.slice(3, -3)).sort()).toEqual([...categories].sort());
  for (const source of projectSources()) {
    const at = meta.pages.indexOf(source.id);
    const separator = meta.pages.slice(0, at).findLast((page) => page.startsWith("---"));
    expect(separator, source.id).toBe(`---${source.category}---`);
  }
  expect(meta.pages[0]).toBe("index");
});
