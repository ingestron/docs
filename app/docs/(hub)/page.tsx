import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { AreaCards } from "@/components/hub";
import { HubSearch } from "@/components/hub-search";
import { areaCards, combinedAreas, platformAreas } from "@/lib/areas";
import { ContinueWithPlatform } from "@/components/platform-choice";
import { source } from "@/lib/source";

// The home page, /docs: search, a card for each platform, then the
// product-wide areas, then the ways in and the value story from
// content/docs/index.mdx.
export default function Hub() {
  const page = source.getPage([]);
  if (!page) notFound();
  const MDX = page.data.body;
  const cards = areaCards(source.getPageTree());
  return (
    // The skip link's target; tabIndex so the next Tab is in the content.
    <div className="hub" id="hub" tabIndex={-1}>
      <section className="hub-hero">
        <div className="hub-width">
          <h1>{page.data.title}</h1>
          <p>{page.data.description}</p>
          <HubSearch />
        </div>
      </section>
      <div className="hub-width hub-body">
        <section aria-labelledby="choose-a-platform">
          <h2 id="choose-a-platform">Choose your platform</h2>
          <p className="hub-lead">
            Each platform has its own docs: getting started, guides, standards and connectors, with
            nothing that does not apply to it. Not sure which?{" "}
            <a href="/docs/concepts/choose-a-platform">Compare them</a>, or try a sample on your
            laptop with <a href="/docs/duckdb/first-project">DuckDB</a>: no cloud account needed.
          </p>
          <ContinueWithPlatform />
          <AreaCards cards={cards.filter((card) => platformAreas.includes(card.url))} />
          <h3 id="combined">Combined</h3>
          <p className="hub-lead">
            Azure Data Factory copies the sources, and another platform keeps the tables.
          </p>
          <AreaCards cards={cards.filter((card) => combinedAreas.includes(card.url))} />
        </section>
        <section aria-labelledby="every-platform">
          <h2 id="every-platform">For every platform</h2>
          <p className="hub-lead">
            Definitions, YAML, the command line and the VS Code extension work the same on each
            platform.
          </p>
          <AreaCards
            cards={cards.filter(
              (card) => !platformAreas.includes(card.url) && !combinedAreas.includes(card.url),
            )}
          />
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
