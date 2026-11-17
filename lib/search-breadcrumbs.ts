// A search result's breadcrumbs: on a platform's page, the platform and its
// section, so the four copies of a shared page are told apart in results.
import type { Root } from "fumadocs-core/page-tree";
import { flattenTree } from "fumadocs-core/page-tree";
import { platformFolder, platformSectionFolders } from "./areas";
import { platformById, platformOfPath } from "./platforms";

/** The platform and section of a platform's page; undefined for a product-wide page, which keeps Fumadocs' own.
 * @example searchBreadcrumbs("/docs/synapse/write-a-contract", tree) // ["Azure Synapse", "Guides"]
 */
export function searchBreadcrumbs(url: string, tree: Root): string[] | undefined {
  const id = platformOfPath(url);
  if (!id) return undefined;
  const section = platformSectionFolders(platformFolder(tree, id)).find((folder) =>
    flattenTree(folder.children).some((item) => item.url === url),
  );
  return [platformById(id).title, ...(section ? [String(section.name)] : [])];
}
