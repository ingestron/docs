import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { ConnectorPicker } from "@/components/connector-picker";
import { AreaTabsCurrent, MenuDialog, SkipLink } from "@/components/keyboard";
import { PlatformMemory } from "@/components/platform-choice";
import { SidebarPageItem } from "@/components/sidebar-item";
import { PlatformPicker } from "@/components/platform-picker";
import { SectionCompanion } from "@/components/section-companion";
import { companionData, headerTabs, siteSections } from "@/lib/areas";
import { baseOptions } from "@/lib/layout.shared";
import { platforms } from "@/lib/platforms";
import { connectorEntries, connectorsFor } from "@/lib/reference";
import { source } from "@/lib/source";

// Every page but the home page. The platform picker after the logo chooses
// whose docs you read; the tab row under the header holds that platform's
// sections, then Concepts and Reference. Each section is a root folder in the
// page tree, so the sidebar lists only its pages, less the connector pages
// (components/sidebar-item.tsx), which the connector picker finds.
export default function Layout({ children }: { children: ReactNode }) {
  const options = baseOptions();
  const tree = source.getPageTree();
  const tabs = headerTabs(tree);
  // Each platform's connectors, for the picker at the top of its Connectors sidebar.
  const pickerLists = Object.fromEntries(
    platforms.map((platform) => [
      platform.id,
      connectorsFor(platform.id).map((id) => ({
        id,
        title: connectorEntries(id)[0]!.connector.title,
      })),
    ]),
  );
  return (
    <>
      {/* The first stop on the page; the article it opens is #nd-page. */}
      <SkipLink target="nd-page" />
      <DocsLayout
        {...options}
        nav={{
          ...options.nav,
          mode: "top",
          // The header puts this in a list of its own children, so it needs a key.
          children: <PlatformPicker key="platform-picker" sites={siteSections(tree)} />,
        }}
        tree={tree}
        tabs={tabs}
        tabMode="navbar"
        sidebar={{
          components: { Item: SidebarPageItem },
          banner: (
            <>
              <ConnectorPicker lists={pickerLists} />
              <SectionCompanion data={companionData(tree)} />
            </>
          ),
        }}
      >
        <MenuDialog />
        <PlatformMemory />
        <AreaTabsCurrent tabs={tabs.map(({ url, urls }) => ({ url, urls: [...(urls ?? [])] }))} />
        {children}
      </DocsLayout>
    </>
  );
}
