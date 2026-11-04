import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { SidebarPageItem } from "@/components/sidebar-item";
import { areaTabs } from "@/lib/areas";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

// Every page but the home page. Each area is a root folder in the page tree:
// the tab bar under the header picks the area, and the sidebar lists only that
// area's pages, less the connector pages (components/sidebar-item.tsx). Below
// the tab bar's width, the menu holds an area picker.
export default function Layout({ children }: { children: ReactNode }) {
  const options = baseOptions();
  const tree = source.getPageTree();
  return (
    <DocsLayout
      {...options}
      nav={{ ...options.nav, mode: "top" }}
      tree={tree}
      tabs={areaTabs(tree)}
      tabMode="navbar"
      sidebar={{ components: { Item: SidebarPageItem } }}
    >
      {children}
    </DocsLayout>
  );
}
