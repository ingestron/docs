import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/notebook/page";
import { getMDXComponents } from "@/components/mdx";
import { RelatedSetup } from "@/components/reference/related-setup";
import { catalogueToc, connectorToc } from "@/lib/connector-page";
import { connectorEntries } from "@/lib/reference";
import { platformOfPath, type Platform } from "@/lib/platforms";
import { movedGuide, source } from "@/lib/source";
export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  const MDX = page.data.body;
  // A platform's connector page, /docs/<platform>/connectors/<id>, and its catalogue.
  const platform = platformOfPath(slug.join("/")) as Platform["id"] | undefined;
  const id = platform && slug[1] === "connectors" && slug.length === 3 ? slug[2] : undefined;
  const connector = id && connectorEntries(id).length ? id : undefined;
  const related = connector ? <RelatedSetup id={connector} platform={platform} /> : undefined;
  // A connector page's headings come from its component, so its contents are built here.
  const toc = connector
    ? connectorToc(connector, page.data.toc, platform)
    : platform && slug.length === 2 && slug[1] === "connectors"
      ? catalogueToc(page.data.toc, platform)
      : page.data.toc;
  return (
    // The breadcrumb starts at the page's area, such as "Connectors" on a connector's page.
    // tabIndex: the skip link focuses the article, so the next Tab is in it.
    <DocsPage
      // A guide's old URL is in no path, so it has no previous or next page.
      footer={{ enabled: !movedGuide(page.path) }}
      toc={toc}
      tableOfContent={{ footer: related }}
      breadcrumb={{ includeRoot: true }}
      tabIndex={-1}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-2">{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
      {related && <div className="related-setup-mobile">{related}</div>}
    </DocsPage>
  );
}
// Every page but the home page, which app/docs/(hub) builds.
export function generateStaticParams() {
  return source.generateParams().filter(({ slug }) => slug.length > 0);
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: page.url },
    // A guide's old URL only links to its platform versions.
    ...(movedGuide(page.path) && { robots: { index: false } }),
  };
}
