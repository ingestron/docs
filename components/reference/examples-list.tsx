// Download cards describe the same resolved samples that the archive builder uses.
import { listExamples, type ExampleInfo } from "@/lib/examples";
import type { Platform } from "@/lib/platforms";
import { packName, platformUsedPacks } from "@/lib/reference";
import { starterCommand } from "@/lib/routes";

/** Matching downloadable projects, with their platforms and connector scope; with
 * `platform`, only the projects its routes build, and a sentence when there is none.
 * @example <ExamplesList connector="sqlserver" platform="synapse" />
 */
export function ExamplesList({
  connector,
  feature,
  kind,
  platform,
}: {
  connector?: string;
  feature?: string;
  kind?: ExampleInfo["kind"];
  platform?: Platform["id"];
}) {
  const used = platform && platformUsedPacks(platform);
  const examples = listExamples().filter(
    (example) =>
      (!connector || example.facts.connectors.includes(connector)) &&
      (!feature || example.facts.features.includes(feature)) &&
      (!kind || example.kind === kind) &&
      (!used || example.facts.packs.every((pack) => used.has(pack))),
  );
  if (examples.length === 0 && used)
    return <p>There is no example project for this source on this platform yet.</p>;
  if (examples.length === 0) throw new Error(`No example for ${connector ?? feature}.`);
  return (
    <div className="example-downloads">
      {examples.map((example) => (
        <Download key={example.name} example={example} />
      ))}
    </div>
  );
}

function Download({ example }: { example: ExampleInfo }) {
  const { name, title, summary, facts } = example;
  return (
    <section className="example-download" aria-label={title}>
      <div className="setting-heading">
        <h3>{title}</h3>
        <span className="setting-meta">ZIP project</span>
      </div>
      <p>{summary}</p>
      <p className="setting-meta">
        {facts.packs.map(packName).join(" + ")}
        {" · "}
        {facts.connectors.length > 1
          ? `Multi-connector project (${facts.connectors.length} connector types)`
          : `${facts.connectors[0]} project`}
      </p>
      {example.template && (
        <p>
          A built-in starter: create it without the download with{" "}
          <code>{starterCommand(example.template)}</code>.
        </p>
      )}
      <p>
        Holds the project's definition files, not its generated files: run{" "}
        <code>ingestron apply</code> in the folder to write them. File previews use these same
        sample files.
      </p>
      <a
        className="download-button"
        download
        href={`/downloads/${name}.zip`}
        aria-label={`Download ${title} project ZIP`}
      >
        ↓ Download project ZIP
      </a>
      <span className="download-filename">{name}.zip</span>
    </section>
  );
}
