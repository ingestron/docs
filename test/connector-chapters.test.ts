// Each connector is one shared file that renders <ConnectorPage> for the
// page's platform and holds only that connector's own notes. Each platform's
// Connectors section lists the catalogue, then each category's link to its
// heading there, with the connectors that platform loads; the old chapters and
// category pages are gone.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectSources } from "@ingestron/core";
import { expect, it } from "vitest";
import { categoryAnchor } from "../lib/connector-page.js";
import { platforms } from "../lib/platforms.js";
import { connectorIds, connectorsFor } from "../lib/reference.js";

const shared = join(process.cwd(), "content/shared/connectors");

for (const id of connectorIds()) {
  it(`${id} is one shared file, rendered from metadata for the page's platform`, () => {
    expect(existsSync(join(shared, id)), `no chapter folder for ${id}`).toBe(false);
    const body = readFileSync(join(shared, `${id}.mdx`), "utf8");
    expect(body.startsWith("---"), `${id}: no front matter; the stubs carry it`).toBe(false);
    // Only the component and its notes: no hand-written facts.
    expect(body.trim().startsWith(`<ConnectorPage id="${id}" platform="~"`), id).toBe(true);
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
  });
}

it("has no file left from the chapters or the category pages", () => {
  const files = readdirSync(shared);
  expect(files.filter((file) => !file.endsWith(".mdx"))).toEqual([]);
  expect(files.sort()).toEqual(["index.mdx", ...connectorIds().map((id) => `${id}.mdx`)].sort());
  expect(existsSync(join(process.cwd(), "content/docs/connectors"))).toBe(false);
});

it.each(
  platforms
    .filter((platform) => connectorsFor(platform.id).length > 0)
    .map((platform) => platform.id),
)(
  "%s lists its catalogue, then each category's link to its heading, with that category's connectors",
  (platform) => {
    const meta = JSON.parse(
      readFileSync(join(process.cwd(), "content/docs", platform, "connectors/meta.json"), "utf8"),
    ) as { pages: string[] };
    const ids = connectorsFor(platform);
    const link = (category: string) =>
      `[${category}](/docs/${platform}/connectors#${categoryAnchor(category)})`;
    expect(meta.pages[0]).toBe("index");
    for (const source of projectSources()) {
      const at = meta.pages.indexOf(source.id);
      expect(at > -1, `${platform} lists ${source.id}`).toBe(ids.includes(source.id));
      if (at === -1) continue;
      expect(meta.pages.filter((page) => page === source.id)).toHaveLength(1);
      expect(
        meta.pages.slice(0, at).findLast((page) => page.startsWith("[")),
        source.id,
      ).toBe(link(source.category));
    }
    // A category is listed only where the platform loads one of its sources.
    for (const page of meta.pages.filter((page) => page.startsWith("[")))
      expect(meta.pages[meta.pages.indexOf(page) + 1]?.startsWith("["), page).toBe(false);
  },
);
