// The site's seven areas. Each is a root folder in the page tree: the tab bar
// picks one, and the sidebar lists only its pages. Every page belongs to one
// area, the home page to none, and no page's URL moved when the areas came in.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectSources } from "@ingestron/cli";
import { findPath, findProjection, flattenTree, type Folder } from "fumadocs-core/page-tree";
import { getLayoutTabs } from "fumadocs-ui/layouts/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EntityIcon } from "../components/hub";
import { areaCardSettings, areaCards, areaTabs, troubleshootingCard } from "../lib/areas.js";
import { categoryAnchor, sourceCategories } from "../lib/connector-page.js";
import { inSidebar } from "../lib/page-tree.js";
import { connectorIds } from "../lib/reference.js";
import { source, tree } from "./tree.js";

const connectors = connectorIds().map((id) => `/docs/connectors/${id}`);

/** Every area's pages, in sidebar order. The connector pages follow the catalogue, in its categories' order. */
const areas: Record<string, string[]> = {
  "Get started": [
    "/docs/start/first-project",
    "/docs/start/how-it-works",
    "/docs/start/choose-a-route",
    "/docs/start/install",
  ],
  "Build a project": [
    "/docs/how-to/start-from-a-template",
    "/docs/how-to/add-a-source",
    "/docs/how-to/write-a-contract",
    "/docs/how-to/write-a-transform",
    "/docs/how-to/keep-a-table-current",
    "/docs/how-to/add-quality-checks",
    "/docs/how-to/define-a-data-product",
    "/docs/how-to/add-an-environment",
    "/docs/how-to/plan-and-generate",
    "/docs/how-to/check-in-ci",
    "/docs/how-to/deploy-through-environments",
  ],
  Platforms: [
    "/docs/platforms/duckdb",
    "/docs/platforms/duckdb-in-azure",
    "/docs/platforms/databricks",
    "/docs/platforms/synapse",
    "/docs/platforms/adf",
    "/docs/platforms/adf-pipelines",
    "/docs/platforms/landing-only",
  ],
  "Standards and teams": [
    "/docs/how-to/configure-a-standard",
    "/docs/how-to/name-things-your-way",
    "/docs/how-to/ask-the-platform-team",
    "/docs/how-to/share-a-template",
    "/docs/how-to/upgrade",
  ],
  Concepts: [
    "/docs/concepts/definitions",
    "/docs/concepts/standards-and-packs",
    "/docs/concepts/settings",
    "/docs/concepts/layers",
    "/docs/concepts/environments-and-platform",
    "/docs/concepts/yaml-references",
    "/docs/concepts/generated-files",
  ],
  Connectors: ["/docs/connectors"],
  Reference: [
    "/docs/reference/documents",
    "/docs/reference/packs",
    "/docs/reference/packs/databricks",
    "/docs/reference/packs/adf",
    "/docs/reference/packs/synapse",
    "/docs/reference/packs/duckdb",
    "/docs/reference/errors",
    "/docs/reference/cli",
    "/docs/reference/templates",
    "/docs/reference/versions",
    "/docs/tools/vscode",
    "/docs/troubleshooting",
  ],
};

const roots = tree.children.filter(
  (node): node is Folder => node.type === "folder" && node.root === true,
);
const pagesOf = (root: Folder) =>
  flattenTree(root.children).filter((item) => !item.url.includes("#"));
/** The area a page's sidebar shows: the last root folder on its path, as Fumadocs picks it. */
const areaOf = (url: string) =>
  findPath(tree.children, (node) => node.type === "page" && node.url === url)?.findLast(
    (node): node is Folder => node.type === "folder" && node.root === true,
  );
/** What a sidebar shows: the area's items that components/sidebar-item.tsx draws. */
const shown = (root: Folder) => flattenTree(root.children).filter((item) => inSidebar(item.url));

describe("areas", () => {
  it("are the seven areas, in order, each a root folder and a tab", () => {
    expect(roots.map((root) => root.name)).toEqual(Object.keys(areas));
    expect(tree.children.map((node) => (node.type === "folder" ? node.name : node.type))).toEqual([
      "page",
      ...Object.keys(areas),
    ]);
    expect(getLayoutTabs(tree).map((tab) => [tab.title, tab.url])).toEqual(
      Object.entries(areas).map(([name, pages]) => [name, pages[0]]),
    );
    // The tab bar's tabs open their area's first page from any page, and are
    // active on every page of their area and no other.
    const tabs = areaTabs(tree);
    expect(tabs.map((tab) => [tab.title, tab.url])).toEqual(
      Object.entries(areas).map(([name, pages]) => [name, pages[0]]),
    );
    for (const [index, tab] of tabs.entries()) {
      expect(tab.$folder, String(tab.title)).toBeUndefined();
      expect([...tab.urls!].filter((url) => !url.includes("#"))).toEqual(
        pagesOf(roots[index]!).map((item) => item.url),
      );
    }
    // Each tab says what is in it, in the phone menu's area picker and on the home page.
    for (const root of roots)
      expect(String(root.description ?? ""), String(root.name)).toMatch(/\.$/);
  });

  it("pin every page to its one area", () => {
    for (const root of roots) {
      const expected = areas[String(root.name)]!;
      const pages = pagesOf(root).map((item) => item.url);
      if (root.name === "Connectors") {
        expect(pages.slice(0, 1)).toEqual(expected);
        expect(pages.slice(1).sort()).toEqual([...connectors].sort());
      } else expect(pages, String(root.name)).toEqual(expected);
    }
    const all = source.getPages().map((page) => page.url);
    const placed = roots.flatMap((root) => pagesOf(root).map((item) => item.url));
    expect(new Set(placed).size, "no page in two areas").toBe(placed.length);
    expect([...placed].sort()).toEqual(all.filter((url) => url !== "/docs").sort());
    // The home page is the hub, in no area; no page is left out of the tree.
    expect(areaOf("/docs")).toBeUndefined();
    expect(tree.fallback).toBeUndefined();
  });

  it("show each page in its own area, with only that area's pages in the sidebar", () => {
    for (const root of roots) {
      const own = new Set(pagesOf(root).map((item) => item.url));
      for (const url of own) expect(areaOf(url)?.name, url).toBe(root.name);
      for (const item of shown(root)) {
        const page = item.url.split("#")[0]!;
        expect(own.has(page), `${String(root.name)} lists ${item.url}`).toBe(true);
      }
    }
    // A tab never follows a page into another area's page of the same file name.
    for (const from of roots)
      for (const item of pagesOf(from))
        for (const to of roots)
          if (to !== from) expect(findProjection(from, to, item), item.url).toBeUndefined();
  });

  it("list the Connectors area as its catalogue and categories, not its connectors", () => {
    const root = roots.find((candidate) => candidate.name === "Connectors")!;
    expect(shown(root).map((item) => [String(item.name), item.url])).toEqual([
      ["All connectors", "/docs/connectors"],
      ...sourceCategories().map((name) => [name, `/docs/connectors#${categoryAnchor(name)}`]),
    ]);
    // Every connector page is in the area, and left out of its sidebar.
    for (const url of connectors) {
      expect(areaOf(url)?.name, url).toBe("Connectors");
      expect(inSidebar(url), url).toBe(false);
    }
    for (const root of roots)
      if (root.name !== "Connectors")
        expect(shown(root), String(root.name)).toEqual(flattenTree(root.children));
    // The layout draws the sidebar's items with the item that leaves them out;
    // scripts/check-links.ts checks the built sidebars.
    const layout = readFileSync(join(process.cwd(), "app/docs/(areas)/layout.tsx"), "utf8");
    expect(layout).toContain("sidebar={{ components: { Item: SidebarPageItem } }}");
    // The breadcrumb's and the tab's "Connectors" open the catalogue.
    expect(root.index?.url).toBe("/docs/connectors");
    expect(projectSources().length).toBe(connectors.length);
  });
});

describe("page URLs", () => {
  it("are the URLs main built before the areas came in, none moved and none added", () => {
    // test/page-urls.txt: every page under out/docs built from main at fe86177.
    // A new page adds its URL here; a moved one needs a redirect in worker/redirects.js.
    const built = readFileSync(join(process.cwd(), "test/page-urls.txt"), "utf8")
      .trim()
      .split("\n");
    expect(built).toHaveLength(124);
    expect(
      source
        .getPages()
        .map((page) => page.url)
        .sort(),
    ).toEqual([...built].sort());
  });
});

describe("the home page's cards", () => {
  it("show each area with its icon, description and three of its own pages, then troubleshooting", () => {
    const cards = areaCards(tree);
    expect(cards.map((card) => card.title)).toEqual([...Object.keys(areas), "Troubleshooting"]);
    for (const [index, card] of cards.slice(0, -1).entries()) {
      expect(card.url).toBe(areas[card.title]![0]);
      expect(card.description).toBe(String(roots[index]!.description));
      expect(card.links).toHaveLength(3);
      for (const link of card.links)
        expect(areaOf(link.url)?.name, `${card.title} → ${link.url}`).toBe(card.title);
    }
    expect(cards.at(-1)).toEqual(troubleshootingCard);
    expect(areaCardSettings.map((setting) => setting.area)).toEqual(
      Object.values(areas).map((pages) => pages[0]),
    );
  });

  it("use the brand's entity icons, copied unchanged, and only those", () => {
    const icons = [...areaCardSettings.map((area) => area.icon), troubleshootingCard.icon];
    expect(new Set(icons).size).toBe(icons.length);
    for (const icon of icons) {
      const svg = readFileSync(join(process.cwd(), "public/brand/icons", `${icon}.svg`), "utf8");
      // Strokes take the text colour and cut-outs the surface, which app/hub.css sets.
      expect(svg, icon).toContain('<svg class="ic"');
      expect(svg, icon).toContain("var(--ingestron-surface,#fff)");
    }
    expect(readdirSync(join(process.cwd(), "public/brand/icons")).sort()).toEqual(
      icons.map((icon) => `${icon}.svg`).sort(),
    );
    const css = readFileSync(join(process.cwd(), "app/hub.css"), "utf8");
    expect(css).toContain("--ingestron-surface: var(--color-fd-card);");
    // The page draws them still, from one stylesheet: no icon brings its own.
    for (const icon of icons) {
      const markup = renderToStaticMarkup(createElement(EntityIcon, { name: icon }));
      expect(markup, icon).toContain('<svg class="ic"');
      expect(markup, icon).not.toContain("<style>");
    }
    expect(css).toMatch(/\.entity-icon \.ic \{[^}]*stroke-width: 2\.2;/);
    // One signal per view: only the first card's icon keeps the signal accent.
    expect(css).toContain(".area-card:not(:first-child) .entity-icon {\n  --s-acc: currentColor;");
  });
});
