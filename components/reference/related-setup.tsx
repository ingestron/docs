// The routes and their packs come from New project's metadata; link text is each page's title.
import { projectRoutes } from "@ingestron/cli";
import { connectorEntries, packName, packs, pageTitle, routePacks } from "@/lib/reference";
import { routeGuides } from "@/lib/routes";

const common = ["how-to/start-from-a-template", "how-to/configure-a-standard"];
/** Setup guides for a pack, shown when one of the connector's routes uses it,
 * unless the Routes list already links the page. */
const packGuides: Record<string, string[]> = {
  adf: ["platforms/adf", "platforms/adf-pipelines"],
  databricks: ["platforms/databricks", "how-to/name-things-your-way"],
};

/** Shared setup links beside connector chapters, or below them on small screens.
 * @example <RelatedSetup id="sqlserver" />
 */
export function RelatedSetup({ id }: { id: string }) {
  if (connectorEntries(id).length === 0) throw new Error(`No pack reads connector "${id}".`);
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
