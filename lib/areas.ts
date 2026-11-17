// The site's areas. Each platform is a site of its own: a folder in
// content/docs whose sections (Get started, Guides, Standards, …) are root
// folders, so the sidebar lists one section. Concepts, Connectors and
// Reference are product-wide root folders. This file gives the tabs for a
// platform, and the home page's cards: their name, description and pages come
// from the tree; this file adds the brand icon and the three links a card
// shows first.
import { flattenTree, type Folder, type Root } from "fumadocs-core/page-tree";
import type { LayoutTab } from "fumadocs-ui/layouts/shared";
import {
  platformById,
  platformPacks,
  platforms,
  platformSections,
  sectionTitles,
  type Platform,
  type SectionId,
  type Sites,
} from "./platforms";

/** One link on a card. */
export interface CardLink {
  title: string;
  url: string;
}

/** One card on the home page. */
export interface AreaCard {
  title: string;
  description: string;
  url: string;
  /** The entity icon's file name in public/brand/icons, without `.svg`. */
  icon: string;
  links: CardLink[];
}

/** Each area, by the page its tab opens; its icon; and the pages its card links first. */
export const areaCardSettings: { area: string; icon: string; links: string[] }[] = [
  {
    area: "/docs/synapse",
    icon: "platform",
    links: [
      "/docs/synapse/first-project",
      "/docs/synapse/describe-a-source",
      "/docs/synapse/deploy",
    ],
  },
  {
    area: "/docs/databricks",
    icon: "platform",
    links: [
      "/docs/databricks/first-project",
      "/docs/databricks/keep-a-table-current",
      "/docs/databricks/deploy",
    ],
  },
  {
    area: "/docs/adf",
    icon: "activity",
    links: ["/docs/adf/first-project", "/docs/adf/pipelines", "/docs/adf/deploy"],
  },
  {
    area: "/docs/duckdb",
    icon: "platform",
    links: [
      "/docs/duckdb/first-project",
      "/docs/duckdb/write-a-transform",
      "/docs/duckdb/cleanse-data",
    ],
  },
  {
    area: "/docs/adf-databricks",
    icon: "activity",
    links: [
      "/docs/adf-databricks/first-project",
      "/docs/adf-databricks/load-with-adf",
      "/docs/adf-databricks/deploy",
    ],
  },
  {
    area: "/docs/adf-synapse",
    icon: "activity",
    links: [
      "/docs/adf-synapse/first-project",
      "/docs/adf-synapse/load-with-adf",
      "/docs/adf-synapse/deploy",
    ],
  },
  {
    area: "/docs/adf-duckdb",
    icon: "activity",
    links: [
      "/docs/adf-duckdb/first-project",
      "/docs/adf-duckdb/load-with-adf",
      "/docs/adf-duckdb/deploy",
    ],
  },
  {
    area: "/docs/concepts/definitions",
    icon: "data-model",
    links: [
      "/docs/concepts/definitions",
      "/docs/concepts/settings",
      "/docs/concepts/choose-a-platform",
    ],
  },
  {
    area: "/docs/reference/documents",
    icon: "contract",
    links: ["/docs/reference/errors", "/docs/reference/cli", "/docs/reference/packs"],
  },
];

/** The areas that are a platform's path, which the home page shows first. */
export const platformAreas = ["/docs/synapse", "/docs/databricks", "/docs/adf", "/docs/duckdb"];

/** The combined sites' areas, which the home page shows after the platforms. */
export const combinedAreas = ["/docs/adf-databricks", "/docs/adf-synapse", "/docs/adf-duckdb"];

/** The last card: troubleshooting is a Reference page, and a common way in. */
export const troubleshootingCard: AreaCard = {
  title: "Troubleshooting",
  description: "A symptom, its cause and the fix; each platform's own problems are in its path.",
  url: "/docs/troubleshooting",
  icon: "review",
  links: [
    {
      title: "ingestron: command not found",
      url: "/docs/troubleshooting#ingestron-command-not-found",
    },
    { title: "Generated files", url: "/docs/troubleshooting#generated-files" },
    {
      title: "Environment variables and .env",
      url: "/docs/troubleshooting#environment-variables-and-env",
    },
  ],
};

/** The top-level root folders: the product-wide areas, Concepts, Connectors and Reference. */
export function productWideAreas(tree: Root): Folder[] {
  return tree.children.filter(
    (node): node is Folder => node.type === "folder" && node.root === true,
  );
}

/** A platform's folder, which holds its sections. */
export function platformFolder(tree: Root, id: Platform["id"]): Folder {
  const title = platformById(id).title;
  const found = tree.children.find(
    (node): node is Folder => node.type === "folder" && !node.root && node.name === title,
  );
  if (!found) throw new Error(`No folder for the platform ${id} ("${title}").`);
  return found;
}

/** The section folders of a platform's site: its root folders. */
export const platformSectionFolders = (folder: Folder): Folder[] =>
  folder.children.filter((node): node is Folder => node.type === "folder" && node.root === true);

const pageUrls = (folder: Folder) =>
  flattenTree(folder.children)
    .map((item) => item.url)
    .filter((url) => !url.includes("#"));

/**
 * The tab row for a platform: its sections in tab order; Concepts and
 * Reference join the product-wide pages with the platform's own, and open on
 * the product-wide ones. With no platform, the product-wide areas only. A tab
 * is active on every page in its `urls`.
 * @example siteTabs(tree, "synapse").map((tab) => tab.title) // ["Get started", "Guides", …]
 */
export function siteTabs(tree: Root, platform?: Platform["id"]): LayoutTab[] {
  const own = platform ? platformSectionFolders(platformFolder(tree, platform)) : [];
  const wide = productWideAreas(tree);
  return platformSections.flatMap((section) => {
    const title = sectionTitles[section];
    const mine = own.find((folder) => folder.name === title);
    const shared = wide.find((folder) => folder.name === title);
    const first =
      section === "concepts" || section === "reference" ? (shared ?? mine) : (mine ?? shared);
    if (!first) return [];
    const urls = [...(shared ? pageUrls(shared) : []), ...(mine ? pageUrls(mine) : [])];
    return [
      {
        title,
        description: (mine ?? shared)!.description,
        url: pageUrls(first)[0]!,
        urls: new Set(urls),
      },
    ];
  });
}

/**
 * The home page's cards: each platform's, then the product-wide areas', with
 * the name and description from the tree and each link's title from its page.
 * @example areaCards(source.getPageTree())
 */
export function areaCards(tree: Root): AreaCard[] {
  const cards = areaCardSettings.map(({ area, icon, links }) => {
    const id = area.split("/")[2] as Platform["id"];
    const isPlatform = platformAreas.includes(area) || combinedAreas.includes(area);
    const folder = isPlatform
      ? platformFolder(tree, id)
      : productWideAreas(tree).find((root) => pageUrls(root)[0] === area);
    if (!folder) throw new Error(`No area opens ${area}.`);
    const pages = flattenTree(folder.children);
    return {
      title: String(folder.name),
      description: String(folder.description ?? ""),
      url: area,
      icon,
      links: links.map((url) => {
        const page = pages.find((candidate) => candidate.url === url);
        if (!page)
          throw new Error(
            `The ${String(folder.name)} card links ${url}, which is not in that area.`,
          );
        return { title: String(page.name), url };
      }),
    };
  });
  return [...cards, troubleshootingCard];
}

/** Each platform's pages by section, in sidebar order, for the platform picker.
 * @example siteSections(tree).synapse.guides[0] // "/docs/synapse/create-a-project"
 */
export function siteSections(tree: Root): Sites {
  return Object.fromEntries(
    platforms.map((platform) => [
      platform.id,
      Object.fromEntries(
        platformSectionFolders(platformFolder(tree, platform.id)).map((folder) => [
          platformSections.find((section) => sectionTitles[section] === folder.name) as SectionId,
          pageUrls(folder),
        ]),
      ),
    ]),
  );
}

/**
 * The header's tab row: every platform's own sections, each tab marked with
 * its platform (`data-platform`), which app/navigation.css shows only for the
 * platform on <html data-site>; then Concepts and Reference, which hold the
 * product-wide pages and every platform's own pages of that kind.
 * @example <DocsLayout tabs={headerTabs(tree)} tabMode="navbar" … />
 */
export function headerTabs(tree: Root): LayoutTab[] {
  const own = platforms.flatMap((platform) =>
    siteTabs(tree, platform.id)
      .filter(
        (tab) => tab.title !== sectionTitles.concepts && tab.title !== sectionTitles.reference,
      )
      .map((tab) => ({ ...tab, props: { "data-platform": platform.id } as LayoutTab["props"] })),
  );
  const wide = siteTabs(tree).map((tab) => {
    const urls = new Set(tab.urls);
    for (const platform of platforms)
      for (const mine of siteTabs(tree, platform.id))
        if (mine.title === tab.title) for (const url of mine.urls ?? []) urls.add(url);
    return { ...tab, urls };
  });
  return [...own, ...wide];
}

/** One link in a sidebar group. */
export interface CompanionLink {
  title: string;
  url: string;
}

/** Concepts' and Reference's pages: the product-wide ones, and each platform's own. */
export type CompanionData = Record<
  "concepts" | "reference",
  { wide: CompanionLink[]; platforms: Record<string, CompanionLink[]> }
>;

/**
 * The pages components/section-companion.tsx lists above a Concepts or
 * Reference sidebar: the product-wide pages on a platform's own page, and a
 * platform's own pages on a product-wide one.
 * @example companionData(tree).concepts.platforms.synapse[0].url // "/docs/synapse/environments-and-platform"
 */
export function companionData(tree: Root): CompanionData {
  const links = (folder: Folder | undefined): CompanionLink[] =>
    folder
      ? flattenTree(folder.children)
          .filter((item) => !item.url.includes("#"))
          .map((item) => ({ title: String(item.name), url: item.url }))
      : [];
  const section = (name: "concepts" | "reference") => ({
    wide: links(productWideAreas(tree).find((folder) => folder.name === sectionTitles[name])),
    platforms: Object.fromEntries(
      platforms.map((platform) => [
        platform.id,
        links(
          platformSectionFolders(platformFolder(tree, platform.id)).find(
            (folder) => folder.name === sectionTitles[name],
          ),
        ),
      ]),
    ),
  });
  // A platform's Reference group also links the packs its routes read with.
  const reference = section("reference");
  for (const platform of platforms)
    reference.platforms[platform.id] = [
      ...(reference.platforms[platform.id] ?? []),
      ...platformPacks(platform.id).map((pack) => {
        const page = reference.wide.find((link) => link.url === `/docs/reference/packs/${pack}`);
        if (!page) throw new Error(`No reference page for the ${pack} pack.`);
        return page;
      }),
    ];
  return { concepts: section("concepts"), reference };
}
