"use client";
// The search dialog, limited to one platform's path and the shared sections:
// the platform of the page you are on, else the one you last read, else all.
// Clear the filter to search every platform. Built from Fumadocs' dialog
// parts, with the platform filter inside the dialog.
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  TagsList,
  TagsListItem,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { useDocsSearch } from "fumadocs-core/search/client";
import { staticClient } from "fumadocs-core/search/client/orama-static";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { platformOfPath, platforms } from "@/lib/platforms";
import { rememberedPlatform } from "@/components/platform-choice";

export function PlatformSearchDialog(props: SharedProps) {
  const path = usePathname();
  const [tag, setTag] = useState<string | undefined>(platformOfPath(path));
  // Each time the dialog opens, the filter starts at the reader's platform.
  useEffect(() => {
    if (props.open) setTag(platformOfPath(path) ?? rememberedPlatform());
  }, [props.open, path]);
  const search = useDocsSearch({ client: staticClient({ tag }) });
  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList />
        <SearchDialogFooter>
          <TagsList tag={tag} onTagChange={setTag} allowClear aria-label="Platform">
            {platforms.map((platform) => (
              <TagsListItem key={platform.id} value={platform.id}>
                {platform.title}
              </TagsListItem>
            ))}
          </TagsList>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
