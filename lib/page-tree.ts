// The page tree's one change to what the meta.json files describe: the
// Connectors area's catalogue is its landing page, listed as "All connectors".
import type { Folder } from "fumadocs-core/page-tree";

/** The catalogue's URL, the landing page of the Connectors area. */
export const catalogueUrl = "/docs/connectors";

/** Opens the Connectors area from its catalogue, which the sidebar calls "All connectors".
 * @example loader({ pageTree: { transformers: [areaNavigation] }, ...options })
 */
export const areaNavigation = {
  folder(node: Folder, path: string): Folder {
    if (path !== "connectors") return node;
    const catalogue = node.children.find(
      (child) => child.type === "page" && child.url === catalogueUrl,
    );
    if (catalogue?.type !== "page") return node;
    return {
      ...node,
      // The breadcrumb's "Connectors" and the area's tab open the catalogue.
      index: catalogue,
      children: node.children.map((child) =>
        child === catalogue ? { ...catalogue, name: "All connectors" } : child,
      ),
    };
  },
};
