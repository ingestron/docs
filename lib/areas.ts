// The home page's area cards. Each area is a root folder in content/docs
// (`"root": true` in its meta.json), which gives its name, its one-line
// description and its pages; this file adds only the brand icon and the three
// links a card shows first.
import { flattenTree, type Folder, type Root } from "fumadocs-core/page-tree";
import { getLayoutTabs } from "fumadocs-ui/layouts/shared";

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

/** Each area's folder under content/docs, its icon, and the pages its card links first. */
export const areaCardSettings: { folder: string; icon: string; links: string[] }[] = [
  {
    folder: "start",
    icon: "project",
    links: ["/docs/start/first-project", "/docs/start/how-it-works", "/docs/start/choose-a-route"],
  },
  {
    folder: "how-to/(build)",
    icon: "activity",
    links: [
      "/docs/how-to/add-a-source",
      "/docs/how-to/write-a-contract",
      "/docs/how-to/write-a-transform",
    ],
  },
  {
    folder: "platforms",
    icon: "platform",
    links: ["/docs/platforms/databricks", "/docs/platforms/adf", "/docs/platforms/duckdb"],
  },
  {
    folder: "how-to/(standards)",
    icon: "standard",
    links: [
      "/docs/how-to/configure-a-standard",
      "/docs/how-to/ask-the-platform-team",
      "/docs/how-to/upgrade",
    ],
  },
  {
    folder: "concepts",
    icon: "data-model",
    links: ["/docs/concepts/definitions", "/docs/concepts/settings", "/docs/concepts/layers"],
  },
  {
    folder: "connectors",
    icon: "connection",
    links: ["/docs/connectors/sqlserver", "/docs/connectors/salesforce", "/docs/connectors"],
  },
  {
    folder: "(reference)",
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

/** The folder under content/docs that an area's root folder comes from. */
export const areaFolder = (folder: Folder) => folder.$ref?.folder;

/**
 * The home page's cards, in the areas' order: the name, description and first
 * page come from the page tree, and each link's title from its page.
 * @example areaCards(source.getPageTree())
 */
export function areaCards(tree: Root): AreaCard[] {
  const tabs = getLayoutTabs(tree, { transform: (tab) => tab });
  const cards = areaCardSettings.map(({ folder, icon, links }) => {
    const tab = tabs.find(
      (candidate) => candidate.$folder && areaFolder(candidate.$folder) === folder,
    );
    if (!tab?.$folder) throw new Error(`No area comes from content/docs/${folder}.`);
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
