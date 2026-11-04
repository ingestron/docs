// What a platform page opens with, from the same route metadata as `ingestron init`.
import { routeRow } from "@/lib/routes";
import { Inline } from "./inline";

/** What has not been tried yet, what runs after each load, what you deploy with, and the command that creates the project.
 * @example <RouteFacts id="adf-synapse" />
 * @example <RouteFacts id="duckdb" />
 */
export function RouteFacts({ id }: { id: string }) {
  const row = routeRow(id);
  const starter = id === "duckdb";
  return (
    <ul>
      {row.status && (
        <li>
          <strong>Status:</strong> <Inline text={row.status} />
        </li>
      )}
      <li>
        <strong>After each load:</strong> <Inline text={row.afterLoad} />
      </li>
      <li>
        <strong>Deploy with:</strong> <Inline text={row.deploy} />
      </li>
      <li>
        <strong>Create it:</strong>{" "}
        <code>
          ingestron init {starter ? "shop" : "sales --connector <connector>"} {row.option}
        </code>
        {starter ? (
          "."
        ) : (
          <>
            , with a connector from the <a href="/docs/connectors">catalogue</a> whose page lists
            this route.
          </>
        )}
      </li>
    </ul>
  );
}
