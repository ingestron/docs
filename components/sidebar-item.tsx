"use client";
// The sidebar's page item, passed to the layout as `sidebar.components.Item`.
// It leaves out the pages the sidebar does not list (lib/page-tree.ts) and
// draws every other page as the notebook layout's own item does.
import type { Item } from "fumadocs-core/page-tree";
import { usePathname } from "fumadocs-core/framework";
import { SidebarItem as BaseItem, useFolderDepth } from "fumadocs-ui/components/sidebar/base";
import { inSidebar } from "@/lib/page-tree";

/** The notebook layout's item classes, from fumadocs-ui 16.17.8 (layouts/notebook/slots/sidebar.js). */
const link =
  "relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere [&_svg]:size-4 [&_svg]:shrink-0 transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary data-[active=true]:hover:transition-colors";
const highlight =
  "data-[active=true]:before:content-[''] data-[active=true]:before:bg-fd-primary data-[active=true]:before:absolute data-[active=true]:before:w-px data-[active=true]:before:inset-y-2.5 data-[active=true]:before:inset-s-2.5";

const trimmed = (path: string) =>
  path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

export function SidebarPageItem({ item }: { item: Item }) {
  const depth = useFolderDepth();
  const pathname = usePathname();
  if (!inSidebar(item.url)) return null;
  return (
    <BaseItem
      href={item.url}
      external={item.external}
      active={trimmed(item.url) === trimmed(pathname)}
      icon={item.icon}
      className={depth >= 1 ? `${link} ${highlight}` : link}
      style={{ paddingInlineStart: `calc(${2 + 3 * depth} * var(--spacing))` }}
    >
      {item.name}
    </BaseItem>
  );
}
