// The site's areas: Get started, a path for each platform, then the shared
// areas. Each is a root folder in the page tree: the tab bar picks one, and the
// sidebar lists only its pages. Every page belongs to one area, the home page
// and a guide's old URL to none.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectSources } from "@ingestron/core";
import { findPath, findProjection, flattenTree, type Folder } from "fumadocs-core/page-tree";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EntityIcon } from "../components/hub";
import {
  areaCardSettings,
  areaCards,
  platformAreas,
  platformFolder,
  platformSectionFolders,
  productWideAreas,
  siteTabs,
  troubleshootingCard,
  combinedAreas,
} from "../lib/areas.js";
import { catalogueToc, categoryAnchor, sourceCategories } from "../lib/connector-page.js";
import { inSidebar } from "../lib/page-tree.js";
import { movedPages, platforms } from "../lib/platforms.js";
import { connectorIds, connectorsFor } from "../lib/reference.js";
import { source, tree } from "./tree.js";
import { redirectFor } from "../worker/redirects.js";

/** The product-wide areas' pages, in sidebar order. The connector pages follow the catalogue. */
const areas: Record<string, string[]> = {
  Concepts: [
    "/docs/concepts/definitions",
    "/docs/concepts/standards-and-packs",
    "/docs/concepts/settings",
    "/docs/concepts/layers",
    "/docs/concepts/yaml-references",
    "/docs/concepts/generated-files",
    "/docs/concepts/choose-a-platform",
  ],
  Reference: [
    "/docs/reference/documents",
    "/docs/reference/intent",
    "/docs/reference/packs",
    "/docs/reference/packs/databricks",
    "/docs/reference/packs/adf",
    "/docs/reference/packs/synapse",
    "/docs/reference/packs/duckdb",
    "/docs/reference/errors",
    "/docs/reference/cli",
    "/docs/reference/recipes",
    "/docs/reference/templates",
    "/docs/reference/versions",
    "/docs/reference/release-notes",
    "/docs/tools/vscode",
    "/docs/tools/assistants",
    "/docs/troubleshooting",
  ],
};

/** One platform's site, pinned in full: each section's pages in sidebar order. */
const synapse: Record<string, string[]> = {
  "Get started": [
    "/docs/synapse",
    "/docs/synapse/install",
    "/docs/synapse/first-project",
    "/docs/synapse/how-it-works",
  ],
  Guides: [
    "/docs/synapse/create-a-project",
    "/docs/synapse/plan-and-generate",
    "/docs/synapse/add-a-source",
    "/docs/synapse/describe-a-source",
    "/docs/synapse/write-a-contract",
    "/docs/synapse/write-a-transform",
    "/docs/synapse/keep-a-table-current",
    "/docs/synapse/cleanse-data",
    "/docs/synapse/add-quality-checks",
    "/docs/synapse/grant-access",
    "/docs/synapse/define-a-data-product",
    "/docs/synapse/run-a-flow-on-its-own-triggers",
    "/docs/synapse/add-an-environment",
    "/docs/synapse/deploy",
    "/docs/synapse/check-in-ci",
    "/docs/synapse/deploy-through-environments",
    "/docs/synapse/ask-the-platform-team",
  ],
  Standards: [
    "/docs/synapse/configure-a-standard",
    "/docs/synapse/name-things-your-way",
    "/docs/synapse/accept-a-warning",
    "/docs/synapse/share-a-template",
    "/docs/synapse/upgrade",
  ],
  Concepts: ["/docs/synapse/environments-and-platform", "/docs/synapse/not-applied"],
  Reference: ["/docs/synapse/troubleshooting"],
};

const roots = productWideAreas(tree);
const pagesOf = (root: Folder) =>
  flattenTree(root.children).filter((item) => !item.url.includes("#"));
/** The area a page's sidebar shows: the last root folder on its path, as Fumadocs picks it. */
const areaOf = (url: string) =>
  findPath(tree.children, (node) => node.type === "page" && node.url === url)?.findLast(
    (node): node is Folder => node.type === "folder" && node.root === true,
  );
/** What a sidebar shows: the area's items that components/sidebar-item.tsx draws. */
const shown = (root: Folder) => flattenTree(root.children).filter((item) => inSidebar(item.url));
/** Every section folder of every platform, and the product-wide areas. */
const allRoots = [
  ...platforms.flatMap((platform) => platformSectionFolders(platformFolder(tree, platform.id))),
  ...roots,
];
/** The old URLs that list a page's platform versions: shared pages', and the connectors'. */
const moved = [
  ...Object.keys(movedPages).map((old) => `/docs/${old}`),
  "/docs/connectors",
  ...connectorIds().map((id) => `/docs/connectors/${id}`),
];

describe("areas", () => {
  it("are the home page, a folder per platform, then the product-wide areas", () => {
    expect(tree.children.map((node) => (node.type === "folder" ? node.name : node.type))).toEqual([
      "page",
      ...platforms.map((platform) => platform.title),
      ...Object.keys(areas),
    ]);
    expect(roots.map((root) => root.name)).toEqual(Object.keys(areas));
    for (const root of allRoots)
      expect(String(root.description ?? ""), String(root.name)).toMatch(/\.$/);
  });

  it("give each platform its sections as tabs, then Concepts and Reference", () => {
    const titles = (id?: (typeof platforms)[number]["id"]) =>
      siteTabs(tree, id).map((tab) => tab.title);
    expect(titles("synapse")).toEqual([
      "Get started",
      "Guides",
      "Standards",
      "Connectors",
      "Concepts",
      "Reference",
    ]);
    expect(titles()).toEqual(["Concepts", "Reference"]);
    const tabs = siteTabs(tree, "synapse");
    for (const tab of tabs) expect(tab.$folder, String(tab.title)).toBeUndefined();
    const tab = (title: string) => tabs.find((candidate) => candidate.title === title)!;
    expect(tab("Get started").url).toBe("/docs/synapse");
    expect(tab("Concepts").url).toBe("/docs/concepts/definitions");
    // A platform's own concept and reference pages light the product-wide tab.
    expect(tab("Concepts").urls!.has("/docs/synapse/not-applied")).toBe(true);
    expect(tab("Reference").urls!.has("/docs/synapse/troubleshooting")).toBe(true);
    expect(tab("Reference").urls!.has("/docs/reference/cli")).toBe(true);
    expect(tab("Guides").urls!.has("/docs/databricks/deploy")).toBe(false);
  });

  it("pin one platform's site in full", () => {
    const sections = platformSectionFolders(platformFolder(tree, "synapse"));
    const pages = Object.fromEntries(
      sections.map((root) => [root.name, pagesOf(root).map((item) => item.url)]),
    );
    const { Connectors: connectorPages, ...rest } = pages;
    expect(rest).toEqual(synapse);
    // Connectors: the catalogue, then each connector Synapse loads.
    expect(connectorPages![0]).toBe("/docs/synapse/connectors");
    expect(connectorPages!.slice(1).sort()).toEqual(
      connectorsFor("synapse")
        .map((id) => `/docs/synapse/connectors/${id}`)
        .sort(),
    );
  });

  it("pin every page to its one area", () => {
    for (const root of roots)
      expect(
        pagesOf(root).map((item) => item.url),
        String(root.name),
      ).toEqual(areas[String(root.name)]);
    const all = source.getPages().map((page) => page.url);
    const placed = allRoots.flatMap((root) => pagesOf(root).map((item) => item.url));
    expect(new Set(placed).size, "no page in two areas").toBe(placed.length);
    expect([...placed].sort()).toEqual(
      all.filter((url) => url !== "/docs" && !moved.includes(url)).sort(),
    );
    // The home page is the hub, in no area. Only a shared page's old URL, which
    // links to its platform versions, is left out of the tree: in no tab, and in
    // no sidebar.
    expect(areaOf("/docs")).toBeUndefined();
    const unlisted = flattenTree(tree.fallback?.children ?? []).map((item) => item.url);
    expect(unlisted.sort()).toEqual([...moved].sort());
    for (const url of moved) expect(inSidebar(url), url).toBe(false);
  });

  it("show each page in its own area, with only that area's pages in the sidebar", () => {
    for (const root of allRoots) {
      const own = new Set(pagesOf(root).map((item) => item.url));
      for (const url of own) expect(areaOf(url), url).toBe(root);
      for (const item of shown(root)) {
        const page = item.url.split("#")[0]!;
        expect(own.has(page), `${String(root.name)} lists ${item.url}`).toBe(true);
      }
    }
  });

  it("find a page on another platform only where that platform has it", () => {
    const guides = (id: (typeof platforms)[number]["id"]) =>
      platformSectionFolders(platformFolder(tree, id)).find((root) => root.name === "Guides")!;
    const item = pagesOf(guides("synapse")).find((i) => i.url === "/docs/synapse/grant-access")!;
    expect(findProjection(guides("synapse"), guides("duckdb"), item)).toBeUndefined();
    expect(findProjection(guides("synapse"), guides("databricks"), item)?.url).toBe(
      "/docs/databricks/grant-access",
    );
  });

  it("list each Connectors section as its catalogue and categories, not its connectors", () => {
    const root = platformSectionFolders(platformFolder(tree, "synapse")).find(
      (candidate) => candidate.name === "Connectors",
    )!;
    const categories = catalogueToc([], "synapse").map((item) => String(item.title));
    expect(shown(root).map((item) => [String(item.name), item.url])).toEqual([
      ["All connectors", "/docs/synapse/connectors"],
      ...categories.map((name) => [name, `/docs/synapse/connectors#${categoryAnchor(name)}`]),
    ]);
    expect(categories.length).toBeLessThanOrEqual(sourceCategories().length);
    // Every connector page is in the section, and left out of its sidebar.
    for (const id of connectorsFor("synapse")) {
      const url = `/docs/synapse/connectors/${id}`;
      expect(areaOf(url), url).toBe(root);
      expect(inSidebar(url), url).toBe(false);
    }
    for (const other of allRoots)
      if (other !== root && other.name !== "Connectors")
        expect(shown(other), String(other.name)).toEqual(flattenTree(other.children));
    // The layout draws the sidebar's items with the item that leaves them out;
    // scripts/check-links.ts checks the built sidebars.
    const layout = readFileSync(join(process.cwd(), "app/docs/(areas)/layout.tsx"), "utf8");
    expect(layout).toContain("components: { Item: SidebarPageItem }");
    expect(layout).toContain("<ConnectorPicker lists={pickerLists} />");
    expect(layout).toContain("<SectionCompanion data={companionData(tree)} />");
    // The breadcrumb's and the tab's "Connectors" open the catalogue.
    expect(root.index?.url).toBe("/docs/synapse/connectors");
    expect(projectSources().length).toBe(connectorIds().length);
  });
});

describe("page URLs", () => {
  it("keep every URL main built before the areas came in, or redirect it", () => {
    // test/page-urls.txt: every page under out/docs built from main at fe86177.
    // A page that moved or was split needs a redirect in worker/redirects.js; a
    // guide that became one page per platform keeps its old URL, which links to them.
    const built = readFileSync(join(process.cwd(), "test/page-urls.txt"), "utf8")
      .trim()
      .split("\n");
    expect(built).toHaveLength(141);
    const now = new Set(source.getPages().map((page) => page.url));
    for (const url of built) {
      const target = redirectFor(new URL(url, "https://docs.ingestron.io"));
      expect(now.has(url) || (target !== undefined && now.has(target.split("#")[0]!)), url).toBe(
        true,
      );
    }
  });

  it("are the pages each area lists, and nothing else new", () => {
    const now = source.getPages().map((page) => page.url);
    const placed = allRoots.flatMap((root) => pagesOf(root).map((item) => item.url));
    expect(now.filter((url) => url !== "/docs").sort()).toEqual([...placed, ...moved].sort());
    expect(placed).toEqual(expect.arrayContaining(Object.values(synapse).flat()));
  });
});

describe("the home page's cards", () => {
  it("show each platform, then each product-wide area, with three of its own pages, then troubleshooting", () => {
    const cards = areaCards(tree);
    expect(cards.map((card) => card.title)).toEqual([
      ...platforms.map((platform) => platform.title),
      ...Object.keys(areas),
      "Troubleshooting",
    ]);
    expect(cards.slice(0, 4).map((card) => card.url)).toEqual(platformAreas);
    // Then the combinations, which the home page shows under "Combined".
    expect(cards.slice(4, 7).map((card) => card.url)).toEqual(combinedAreas);
    for (const card of cards.slice(0, -1)) {
      expect(card.description, card.title).toMatch(/\.$/);
      expect(card.links).toHaveLength(3);
      for (const link of card.links) {
        const area = areaOf(link.url);
        expect(area, `${card.title} → ${link.url}`).toBeDefined();
        if (platformAreas.includes(card.url) || combinedAreas.includes(card.url))
          expect(link.url.startsWith(`${card.url}/`), `${card.title} → ${link.url}`).toBe(true);
        else expect(area!.name, `${card.title} → ${link.url}`).toBe(card.title);
      }
    }
    expect(cards.at(-1)).toEqual(troubleshootingCard);
  });

  it("sit under a header whose Platforms menu opens each platform's docs", () => {
    const layout = readFileSync(join(process.cwd(), "app/docs/(hub)/layout.tsx"), "utf8");
    expect(layout).toContain('{ type: "menu", text: "Platforms", items }');
    expect(layout).toContain("url: `/docs/${platform.id}`");
    const hub = readFileSync(join(process.cwd(), "app/docs/(hub)/page.tsx"), "utf8");
    expect(hub).toContain('<h2 id="choose-a-platform">Choose your platform</h2>');
    expect(hub).toContain('<a href="/docs/duckdb/first-project">DuckDB</a>');
    expect(hub).toContain('<h2 id="every-platform">For every platform</h2>');
  });

  it("use the brand's entity icons, copied unchanged, and only those", () => {
    const icons = [
      ...new Set([...areaCardSettings.map((area) => area.icon), troubleshootingCard.icon]),
    ];
    // Each card has its own icon, except the platforms' and the combinations', which share one each.
    const others = areaCardSettings.filter(
      (card) => !platformAreas.includes(card.area) && !combinedAreas.includes(card.area),
    );
    expect(new Set(others.map((card) => card.icon)).size).toBe(others.length);
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
