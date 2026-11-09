// Routes stay in package metadata; the sections below them on the page give the detail.
import { Fragment, type ReactNode } from "react";
import { projectRoutes } from "@ingestron/core";
import { ingestionRows } from "@/lib/connector-settings";
import { listExamples } from "@/lib/examples";
import { connectorEntries, packName, type ConnectorEntry } from "@/lib/reference";
import { connectorCommand, starter, starterCommand } from "@/lib/routes";

/** A compact summary of each pack that reads the connector, the routes it starts and the command for each, then the starters that read it.
 * @example <ConnectorFacts id="sqlserver" />
 */
export function ConnectorFacts({ id }: { id: string }) {
  const entries = connectorEntries(id);
  if (entries.length === 0) throw new Error(`No pack reads connector "${id}".`);
  return (
    <div className="connector-routes">
      {entries.map((entry) => (
        <Route key={entry.pack} id={id} entry={entry} />
      ))}
      <Starters id={id} />
    </div>
  );
}

function Route({ id, entry }: { id: string; entry: ConnectorEntry }) {
  const { pack, connector } = entry;
  return (
    <section>
      <h3>{packName(pack)}</h3>
      <dl className="connector-summary">
        {routeFacts(id, entry).map(([label, value]) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </Fragment>
        ))}
      </dl>
      <nav aria-label={`${connector.title} with ${packName(pack)}`} className="chapter-links">
        <a href={`#${pack}-connection`}>Connect with {packName(pack)} ↓</a>
        <a href={`#${pack}-ingestion`}>Read with {packName(pack)} ↓</a>
        <a href={connector.docs}>Vendor prerequisites ↗</a>
      </nav>
    </section>
  );
}

function routeFacts(
  id: string,
  { pack, connector, connectivity }: ConnectorEntry,
): [string, ReactNode][] {
  const { reading, maturity } = connector;
  const modes = ingestionRows(id, pack).find((field) => field.path.join(".") === "mode")?.values;
  const routes = projectRoutes(id).filter((route) => route.method === connector.method);
  if (routes.length === 0) throw new Error(`No route reads "${id}" with ${connector.method}.`);
  const facts: [string, ReactNode][] = [
    [
      "Routes",
      <ul key="routes" className="route-list">
        {routes.map(({ via, title }) => (
          <li key={via}>
            {title} (<code>{via}</code>)
          </li>
        ))}
      </ul>,
    ],
    [
      "Create it",
      <ul key="create" className="route-list">
        {routes.map(({ via }) => (
          <li key={via}>
            <code>{connectorCommand(id, via)}</code>
          </li>
        ))}
      </ul>,
    ],
    ["Method", <code key="method">{connector.method}</code>],
    ["Connectivity", connectivity.join(", ") || "any"],
    ["Source object", <code key="object">{connector.object}</code>],
    ["Generates", connector.generates],
  ];
  if (reading)
    facts.push([
      "Reading",
      `Full selection · ${reading.format} landing · query ${reading.query}${reading.runtime ? ` · ${reading.runtime} runtime required` : ""}`,
    ]);
  else if (modes) facts.push(["Reading modes", modes.map((mode) => String(mode.value)).join(", ")]);
  if (maturity) facts.push(["Availability", `${maturity.status} · checked ${maturity.checked}`]);
  return facts;
}

/** The built-in starters whose connections use the connector, the one with no cloud first. */
function Starters({ id }: { id: string }) {
  const starters = listExamples()
    .filter((example) => example.template && example.facts.connectors.includes(id))
    .sort((a, b) => Number(b.template === starter) - Number(a.template === starter));
  if (starters.length === 0) return null;
  return (
    <section>
      <h3>Starters</h3>
      <p>Complete projects that read this source, ready to create:</p>
      <ul className="route-list">
        {starters.map((example) => (
          <li key={example.name}>
            {example.title} ({example.facts.packs.map(packName).join(" + ")}):{" "}
            <code>{starterCommand(example.template!)}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
