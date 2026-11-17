import type { StructuredData } from "fumadocs-core/mdx-plugins";
import { createFromSource } from "fumadocs-core/search/server";
import { extraStructure, searchTitle } from "@/lib/search";
import { searchBreadcrumbs } from "@/lib/search-breadcrumbs";
import { platformIds, platformOfPath } from "@/lib/platforms";
import { movedGuide, source } from "@/lib/source";

// Exported once at build time as a static search index. Reference rendered
// from code is added to its page's entries, so error codes and settings are found.
// A platform page is tagged with its platform and a shared page with every
// platform, so the dialog's platform filter keeps the shared sections. A
// guide's old URL, which only links to its versions, is left out.
export const revalidate = false;
const indexed = {
  ...source,
  getPages: () => source.getPages().filter((page) => !movedGuide(page.path)),
};
export const { staticGET: GET } = createFromSource(indexed as typeof source, {
  language: "english",
  buildIndex(page) {
    const own = page.data.structuredData as StructuredData;
    const extra = extraStructure(page.url);
    return {
      title: searchTitle(page.url, page.data.title ?? page.url),
      description: page.data.description,
      url: page.url,
      id: page.url,
      tag: platformOfPath(page.url) ?? [...platformIds],
      // A platform's page starts with its platform, so the copies of a shared page differ.
      breadcrumbs: searchBreadcrumbs(page.url, source.getPageTree()),
      structuredData: {
        headings: [...own.headings, ...extra.headings],
        contents: [...own.contents, ...extra.contents],
      },
    };
  },
});
