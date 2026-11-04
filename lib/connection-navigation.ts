// A folder's label opens its landing page; the catalogue's separators become
// collapsed category groups, so the long list of connectors stays compact.
import type { Folder, Node } from "fumadocs-core/page-tree";

/** Keep connectors in the global tree, grouped by the categories in their metadata.
 * @example loader({ pageTree: { transformers: [connectionNavigation] }, ...options })
 */
export const connectionNavigation = {
  folder(node: Folder, path: string): Folder {
    const index = node.children.find(
      (child) => child.type === "page" && child.url === `/docs/${path}`,
    );
    const children = node.children.filter((child) => child !== index);
    return {
      ...node,
      index: index?.type === "page" ? index : node.index,
      children: path === "connectors" ? groupSections(children, path) : children,
    };
  },
};

/** A folder per separator, holding the pages after it. A category has no page of its own. */
function groupSections(nodes: Node[], path: string): Node[] {
  const children: Node[] = [];
  let group: Folder | undefined;
  for (const [index, node] of nodes.entries()) {
    if (node.type === "separator") {
      group = {
        type: "folder",
        $id: `navigation:${path}:${index}`,
        name: node.name,
        defaultOpen: false,
        children: [],
      };
      children.push(group);
    } else (group?.children ?? children).push(node);
  }
  return children;
}
