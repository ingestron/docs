// The home page's parts: the area cards with the brand's entity icons, and the
// two ways in, one for data engineers and one for platform teams.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "fumadocs-core/link";
import type { ReactNode } from "react";
import type { AreaCard } from "@/lib/areas";

/**
 * A brand entity icon, inline so that its strokes take the text colour and its
 * cut-outs the card's colour (`--ingestron-surface`, set in app/hub.css). The
 * card's heading names it, so screen readers skip it.
 * @example <EntityIcon name="platform" />
 */
export function EntityIcon({ name }: { name: string }) {
  const svg = readFileSync(join(process.cwd(), "public/brand/icons", `${name}.svg`), "utf8");
  return (
    <span className="entity-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

/** One card per area: its icon, name, description and first three pages.
 * @example <AreaCards cards={areaCards(source.getPageTree())} />
 */
export function AreaCards({ cards }: { cards: AreaCard[] }) {
  return (
    <ul className="area-cards">
      {cards.map((card) => (
        <li key={card.url} className="area-card">
          <EntityIcon name={card.icon} />
          <h3>
            <Link href={card.url}>{card.title}</Link>
          </h3>
          <p>{card.description}</p>
          <ul aria-label={`In ${card.title}`}>
            {card.links.map((link) => (
              <li key={link.url}>
                <Link href={link.url}>{link.title}</Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** The ways in, side by side on a wide screen.
 * @example <Paths><Path reader="Data engineers" title="…">…</Path></Paths>
 */
export function Paths({ children }: { children: ReactNode }) {
  return <div className="reader-paths">{children}</div>;
}

/** One way in: who it is for, what they do first, and where to go. */
export function Path({
  reader,
  title,
  children,
}: {
  reader: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="reader-path" aria-label={reader}>
      <p className="reader-path-reader">{reader}</p>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
