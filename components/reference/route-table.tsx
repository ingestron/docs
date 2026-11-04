// Where data can go, from the same route metadata as `ingestron init`.
import { packName, pageTitle } from "@/lib/reference";
import { routeRows } from "@/lib/routes";
import { Inline } from "./inline";

/** Every way to start a project: compact on the home page, with the decision columns on the route page.
 * @example <RouteTable />
 * @example <RouteTable detail />
 */
export function RouteTable({ detail = false }: { detail?: boolean }) {
  const rows = routeRows();
  return (
    // The same scrolling, focusable frame Fumadocs gives a Markdown table.
    <div
      className="relative overflow-auto prose-no-margin my-6 route-table"
      tabIndex={0}
      role="region"
      aria-label="Where your data can go"
    >
      <table>
        <thead>
          <tr>
            <th>Route</th>
            {detail ? (
              <>
                <th>Choose it when</th>
                <th>What runs after each load</th>
                <th>Deploy with</th>
                <th>Guide</th>
              </>
            ) : (
              <th>Packs</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {detail ? row.title : <a href={`/docs/${row.guide}`}>{row.title}</a>}
                <br />
                <code>{row.option}</code>
                {row.status && (
                  <>
                    <br />
                    <span className="setting-meta">
                      <Inline text={row.status} />
                    </span>
                  </>
                )}
                {detail && (
                  <>
                    <br />
                    <span className="setting-meta">{row.packs.map(packName).join(" + ")}</span>
                  </>
                )}
              </td>
              {detail ? (
                <>
                  <td>
                    <Inline text={row.choose} />
                  </td>
                  <td>
                    <Inline text={row.afterLoad} />
                  </td>
                  <td>
                    <Inline text={row.deploy} />
                  </td>
                  <td>
                    <a href={`/docs/${row.guide}`}>{pageTitle(row.guide)}</a>
                  </td>
                </>
              ) : (
                <td>{row.packs.map(packName).join(" + ")}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
