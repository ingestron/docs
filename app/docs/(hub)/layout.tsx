import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { SkipLink } from "@/components/keyboard";
import { baseOptions } from "@/lib/layout.shared";
import { platforms } from "@/lib/platforms";

// The home page is the hub: no sidebar and no contents, only the header. Where
// the other pages have the platform picker and its tab bar, its header has a
// Platforms menu: each platform's docs, with the one line its card shows.
export default function Layout({ children }: { children: ReactNode }) {
  const options = baseOptions();
  const items = platforms.map((platform) => ({
    text: platform.title,
    description: platform.summary,
    url: `/docs/${platform.id}`,
  }));
  return (
    <>
      <SkipLink target="hub" />
      <HomeLayout
        {...options}
        links={[{ type: "menu", text: "Platforms", items }, ...(options.links ?? [])]}
      >
        {children}
      </HomeLayout>
    </>
  );
}
