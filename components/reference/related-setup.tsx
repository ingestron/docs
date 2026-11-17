// The routes and their packs come from New project's metadata; link text is each page's title.
import { projectRoutes } from "@ingestron/core";
import { platformById, type Platform } from "@/lib/platforms";
import { connectorEntries, packName, packs, pageTitle, routePacks } from "@/lib/reference";
import { routeGuides } from "@/lib/routes";

const common = [
  "how-to/start-from-a-template",
  "how-to/add-a-source",
  "how-to/configure-a-standard",
];
/** Setup guides for a pack, shown when one of the connector's routes uses it,
 * unless the Routes list already links the page. */
const packGuides: Record<string, string[]> = {
  adf: ["adf", "adf/pipelines"],
  databricks: ["databricks", "how-to/name-things-your-way"],
};

/** Setup links beside a connector's page, or below it on small screens; on a
 * platform's copy, that platform's guides, routes and pack reference.
 * @example <RelatedSetup id="sqlserver" platform="synapse" />
 */
export function RelatedSetup({ id, platform }: { id: string; platform?: Platform["id"] }) {
  if (connectorEntries(id).length === 0) throw new Error(`No pack reads connector "${id}".`);
  if (platform) return <OnPlatform id={id} platform={platform} />;
  const routes = projectRoutes(id).filter(
    (route, index, all) => all.findIndex((other) => other.via === route.via) === index,
  );
  const used = new Set(routes.flatMap((route) => routePacks(route.via)));
  // The packs that read the connector first, then the packs their routes hand over to.
  const readers = connectorEntries(id).map((entry) => entry.pack);
  const groups = [
    ...readers,
    ...packs.map((pack) => pack.id).filter((pack) => !readers.includes(pack)),
  ].filter((pack) => used.has(pack) && packGuides[pack]);
  const linked = new Set(routes.map((route) => routeGuides[route.via]));
  return (
    <nav className="related-setup" aria-label="Related setup">
      <p>Related setup</p>
      <Links pages={common} />
      <p>Routes</p>
      <ul>
        {routes.map(({ via, title }) => {
          const guide = routeGuides[via];
          if (!guide) throw new Error(`No guide for the route "${via}".`);
          return (
            <li key={via}>
              <a href={`/docs/${guide}`}>{title}</a>
            </li>
          );
        })}
      </ul>
      {groups.map((pack) => (
        <div key={pack}>
          <p>{packName(pack)}</p>
          <Links pages={packGuides[pack]!.filter((page) => !linked.has(page))} />
        </div>
      ))}
    </nav>
  );
}

function Links({ pages }: { pages: string[] }) {
  return (
    <ul>
      {pages.map((page) => (
        <li key={page}>
          <a href={`/docs/${page}`}>{pageTitle(page)}</a>
        </li>
      ))}
    </ul>
  );
}

/** A platform's connector page's setup links: its guides, its routes for the source, its packs' reference. */
function OnPlatform({ id, platform }: { id: string; platform: Platform["id"] }) {
  const routes = projectRoutes(id)
    .filter((route) => platformById(platform).routes.includes(route.via))
    .filter((route, index, all) => all.findIndex((other) => other.via === route.via) === index);
  // A combination's own guides; a platform's start, grow and standard pages.
  const guides = (
    platformById(platform).kind === "combined"
      ? ["first-project", "load-with-adf", "deploy"]
      : ["create-a-project", "add-a-source", "configure-a-standard"]
  ).map((page) => `${platform}/${page}`);
  // The packs this source's routes use here, not every pack the platform has.
  const used = new Set(routes.flatMap((route) => routePacks(route.via)));
  const reference = packs
    .map((pack) => pack.id)
    .filter((pack) => used.has(pack))
    .map((pack) => `reference/packs/${pack}`);
  return (
    <nav className="related-setup" aria-label="Related setup">
      <p>Related setup</p>
      <Links pages={guides} />
      <p>Routes</p>
      <ul>
        {routes.map(({ via, title }) => (
          <li key={via}>
            <a href={`/docs/${routeGuides[via]}`}>{title}</a>
          </li>
        ))}
      </ul>
      <p>Reference</p>
      <Links pages={reference} />
    </nav>
  );
}
