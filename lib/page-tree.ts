// The page tree's changes to what the meta.json files describe: each
// platform's Connectors section opens on its catalogue, listed as "All
// connectors", and its connector pages stay in the section but out of its
// sidebar, where the connector picker finds them.
import type { Folder } from "fumadocs-core/page-tree";
import { movedPages, platformIds } from "./platforms";

/** A platform's catalogue, the landing page of its Connectors section. */
export const catalogueUrl = (platform: string) => `/docs/${platform}/connectors`;

/** Opens each Connectors section from its catalogue, which the sidebar calls "All connectors".
 * @example loader({ pageTree: { transformers: [areaNavigation] }, ...options })
 */
export const areaNavigation = {
  folder(node: Folder, path: string): Folder {
    // The old catalogue URL is a page like the other old URLs, not a folder link.
    if (path === "(moved)/connectors" && node.index)
      return { ...node, index: undefined, children: [node.index, ...node.children] };
    const platform = platformIds.find((id) => path === `${id}/connectors`);
    if (!platform) return node;
    const catalogue = node.children.find(
      (child) => child.type === "page" && child.url === catalogueUrl(platform),
    );
    if (catalogue?.type !== "page") return node;
    return {
      ...node,
      // The breadcrumb's "Connectors" and the section's tab open the catalogue.
      index: catalogue,
      children: node.children.map((child) =>
        child === catalogue ? { ...catalogue, name: "All connectors" } : child,
      ),
    };
  },
};

/** A platform's connector page: /docs/<platform>/connectors/<id>. */
const connectorPage = /^\/docs\/[a-z]+\/connectors\/[^/#]+$/;

/**
 * Whether the sidebar lists a page. A connector's page is in its platform's
 * Connectors section, so it keeps the section's tab, sidebar and breadcrumb,
 * but the sidebar lists the catalogue and its categories, not every connector.
 * @example inSidebar("/docs/synapse/connectors/sqlserver") // false
 */
export const inSidebar = (url: string) =>
  !connectorPage.test(url) && !movedUrls.has(url) && !oldConnectors.test(url);

/** A connector's old URL, /docs/connectors/<id>, or the old catalogue's. */
const oldConnectors = /^\/docs\/connectors(?:\/|$)/;

/**
 * The old URLs that only link to a page's platform versions: the shared
 * pages' and the connectors'. Their pages sit in a root folder no meta.json
 * lists, so Fumadocs keeps them out of the tab bar, and the sidebar lists none.
 */
const movedUrls = new Set(Object.keys(movedPages).map((old) => `/docs/${old}`));
