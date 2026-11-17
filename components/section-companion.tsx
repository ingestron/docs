"use client";
// Above a Concepts or Reference sidebar: the other half of that section. A
// platform's own page (its troubleshooting, what it cannot apply) lists the
// pages every platform shares; a shared page lists the remembered platform's
// own. Links only; the sidebar below is the section's own tree.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { rememberedPlatform } from "@/components/platform-choice";
import type { CompanionData, CompanionLink } from "@/lib/areas";
import { platformById, platformOfPath, type Platform } from "@/lib/platforms";

/**
 * The group for a page: its heading and links, or undefined outside Concepts
 * and Reference, or on a shared page with no platform remembered.
 * @example companionFor("/docs/reference/cli", "duckdb", data) // { heading: "On DuckDB", links: […] }
 */
export function companionFor(
  path: string,
  remembered: string | undefined,
  data: CompanionData,
): { heading: string; links: CompanionLink[] } | undefined {
  const page = path.length > 1 ? path.replace(/\/$/, "") : path;
  const own = platformOfPath(page);
  for (const section of Object.values(data)) {
    if (own && section.platforms[own]?.some((link) => link.url === page))
      return { heading: "For every platform", links: section.wide };
    if (!own && remembered && section.wide.some((link) => link.url === page)) {
      const links = section.platforms[remembered] ?? [];
      if (links.length === 0) return undefined;
      return { heading: `On ${platformById(remembered).title}`, links };
    }
  }
  return undefined;
}

/** The group, in the sidebar's banner.
 * @example <SectionCompanion data={companionData(tree)} />
 */
export function SectionCompanion({ data }: { data: CompanionData }) {
  const path = usePathname() ?? "";
  const [remembered, setRemembered] = useState<Platform["id"]>();
  useEffect(() => setRemembered(rememberedPlatform() as Platform["id"] | undefined), [path]);
  const found = companionFor(path, remembered, data);
  if (!found) return null;
  return (
    <nav className="section-companion" aria-label={found.heading}>
      <p>{found.heading}</p>
      <ul>
        {found.links.map((link) => (
          <li key={link.url}>
            <Link href={link.url} aria-current={link.url === path ? "page" : undefined}>
              {link.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
