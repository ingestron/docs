// The home page's area cards. Each area is a root folder in content/docs
// (`"root": true` in its meta.json), which gives its name, its one-line
// description and its pages; this file adds only the brand icon and the three
// links a card shows first, and finds each area by the page its tab opens.
import { flattenTree, type Root } from "fumadocs-core/page-tree";
import { getLayoutTabs, type LayoutTab } from "fumadocs-ui/layouts/shared";

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
    area: "/docs/start/first-project",
    icon: "project",
    links: ["/docs/start/first-project", "/docs/start/how-it-works", "/docs/start/choose-a-route"],
  },
  {
    area: "/docs/how-to/start-from-a-template",
    icon: "activity",
    links: [
      "/docs/how-to/add-a-source",
      "/docs/how-to/write-a-contract",
      "/docs/how-to/write-a-transform",
    ],
  },
  {
    area: "/docs/platforms/duckdb",
    icon: "platform",
    links: ["/docs/platforms/databricks", "/docs/platforms/adf", "/docs/platforms/duckdb"],
  },
  {
    area: "/docs/how-to/configure-a-standard",
    icon: "standard",
    links: [
      "/docs/how-to/configure-a-standard",
      "/docs/how-to/choose-a-published-standard",
      "/docs/how-to/ask-the-platform-team",
    ],
  },
  {
    area: "/docs/concepts/definitions",
    icon: "data-model",
    links: ["/docs/concepts/definitions", "/docs/concepts/settings", "/docs/concepts/layers"],
  },
  {
    area: "/docs/connectors",
    icon: "connection",
    links: ["/docs/connectors/sqlserver", "/docs/connectors/salesforce", "/docs/connectors"],
  },
  {
    area: "/docs/reference/documents",
    icon: "contract",
    links: ["/docs/reference/errors", "/docs/reference/cli", "/docs/reference/packs"],
  },
];

/** The last card: troubleshooting is a Reference page, and a common way in. */
export const troubleshootingCard: AreaCard = {
  title: "Troubleshooting",
  description: "A symptom, its cause and the fix, for every route.",
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

/**
 * The home page's cards, in the areas' order: the name, description and first
 * page come from the page tree, and each link's title from its page.
 * @example areaCards(source.getPageTree())
 */
export function areaCards(tree: Root): AreaCard[] {
  const tabs = getLayoutTabs(tree, { transform: (tab) => tab });
  const cards = areaCardSettings.map(({ area, icon, links }) => {
    const tab = tabs.find((candidate) => candidate.url === area);
    if (!tab?.$folder) throw new Error(`No area's tab opens ${area}.`);
    const pages = flattenTree(tab.$folder.children);
    return {
      title: String(tab.title),
      description: String(tab.description ?? ""),
      url: tab.url,
      icon,
      links: links.map((url) => {
        const page = pages.find((candidate) => candidate.url === url);
        if (!page)
          throw new Error(`The ${String(tab.title)} card links ${url}, which is not in that area.`);
        return { title: String(page.name), url };
      }),
    };
  });
  return [...cards, troubleshootingCard];
}

/**
 * The tab bar's tabs: each opens its area's first page, and is active on any
 * page of its area. A tab bound to its folder would open the page at the same
 * place in another area, and the current page in its own.
 * @example <DocsLayout tabs={areaTabs(tree)} tabMode="navbar" … />
 */
export function areaTabs(tree: Root): LayoutTab[] {
  return getLayoutTabs(tree, {
    transform: (tab, folder) => ({
      title: tab.title,
      description: tab.description,
      url: tab.url,
      urls: new Set(flattenTree(folder.children).map((page) => page.url)),
    }),
  });
}
