// Every route, one line each, from the same route metadata as `ingestron init`,
// so a list of routes on a page cannot leave one out.
import { pageTitle } from "@/lib/reference";
import { routeRows } from "@/lib/routes";
import { Inline } from "./inline";

/** Each route's guide and when to choose it, or, with `deploy`, where its guide says how to deploy it.
 * @example <RouteList />
 * @example <RouteList deploy />
 */
export function RouteList({ deploy = false }: { deploy?: boolean }) {
  return (
    <ul>
      {routeRows().map((row) => (
        <li key={row.id}>
          {deploy ? (
            <>
              <a href={row.deployAt}>
                {pageTitle(row.deployAt.slice("/docs/".length).split("#")[0]!)}: {row.deployStep}
              </a>
              . <Inline text={row.deploy} />
            </>
          ) : (
            <>
              <a href={`/docs/${row.guide}`}>{pageTitle(row.guide)}</a>:{" "}
              <Inline text={row.choose} />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
