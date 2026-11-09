// A compact comparison uses the same supported routes as New project.
import { projectRoutes, projectSources } from "@ingestron/core";
import { allRoutes } from "@/lib/reference";
import { TableFrame } from "@/components/table-frame";

/** Compare selected sources across every route, without maintaining a second support matrix.
 * @example <RouteComparison ids={["files", "sqlserver"]} />
 */
export function RouteComparison({ ids }: { ids: string[] }) {
  const sources = projectSources();
  const routes = allRoutes();
  return (
    <TableFrame label="Routes for each source" className="route-comparison">
      <table>
        <thead>
          <tr>
            <th>Source</th>
            {routes.map(({ via, title }) => (
              <th key={via}>
                {title}
                <br />
                <code>{via}</code>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const source = sources.find((item) => item.id === id);
            if (!source) throw new Error(`No source "${id}".`);
            return (
              <tr key={id}>
                <td>
                  <a href={`/docs/connectors/${id}`}>{source.title}</a>
                </td>
                {routes.map(({ via }) => (
                  <RouteCell key={via} id={id} via={via} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableFrame>
  );
}

function RouteCell({ id, via }: { id: string; via: string }) {
  const route = projectRoutes(id).find((route) => route.via === via);
  if (!route) return <td>Not supported</td>;
  return (
    <td>
      <code>{route.method}</code>
      <br />
      {route.connectivity.join(", ")}
      <br />
      {route.maturity}
    </td>
  );
}
