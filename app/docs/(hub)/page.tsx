import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { AreaCards } from "@/components/hub";
import { HubSearch } from "@/components/hub-search";
import { areaCards } from "@/lib/areas";
import { source } from "@/lib/source";

// The home page, /docs: search, a card for each area, then the two ways in
// and the value story from content/docs/index.mdx.
export default function Hub() {
  const page = source.getPage([]);
  if (!page) notFound();
  const MDX = page.data.body;
  return (
    <div className="hub">
      <section className="hub-hero">
        <div className="hub-width">
          <h1>{page.data.title}</h1>
          <p>{page.data.description}</p>
          <HubSearch />
        </div>
      </section>
      <div className="hub-width hub-body">
        <section aria-labelledby="choose-an-area">
          <h2 id="choose-an-area">Choose an area</h2>
          <p className="hub-lead">Each area has its own short menu.</p>
          <AreaCards cards={areaCards(source.getPageTree())} />
        </section>
        <div className="prose hub-prose">
          <MDX components={getMDXComponents()} />
        </div>
      </div>
    </div>
  );
}

export function generateMetadata(): Metadata {
  const page = source.getPage([]);
  if (!page) notFound();
  return {
    title: { absolute: page.data.title },
    description: page.data.description,
    alternates: { canonical: page.url },
  };
}
