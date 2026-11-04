import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { getLayoutTabs } from "fumadocs-ui/layouts/shared";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

// The home page is the hub: no sidebar and no contents, only the header. Where
// the other pages have their tab bar, its header has an Areas menu: seven
// links in a row would not fit beside the search at a laptop's width.
export default function Layout({ children }: { children: ReactNode }) {
  const options = baseOptions();
  const areas = getLayoutTabs(source.getPageTree()).map((tab) => ({
    text: tab.title,
    description: tab.description,
    url: tab.url,
  }));
  return (
    <HomeLayout
      {...options}
      links={[{ type: "menu", text: "Areas", items: areas }, ...(options.links ?? [])]}
    >
      {children}
    </HomeLayout>
  );
}
