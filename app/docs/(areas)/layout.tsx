import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

// Every page but the home page. Each area is a root folder in the page tree:
// the tab bar under the header picks the area, and the sidebar lists only that
// area's pages. Below the tab bar's width, the menu holds an area picker.
export default function Layout({ children }: { children: ReactNode }) {
  const options = baseOptions();
  return (
    <DocsLayout
      {...options}
      nav={{ ...options.nav, mode: "top" }}
      tree={source.getPageTree()}
      tabMode="navbar"
    >
      {children}
    </DocsLayout>
  );
}
