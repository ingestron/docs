// The versions this site is built with, read from the installed packages.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packName, packs } from "@/lib/reference";
import { Inline } from "./inline";

interface Manifest {
  name: string;
  version: string;
  devDependencies?: Record<string, string>;
}

const installed = (name: string): Manifest =>
  JSON.parse(readFileSync(join(process.cwd(), "node_modules", name, "package.json"), "utf8"));
const readme = (name: string): string =>
  readFileSync(join(process.cwd(), "node_modules", name, "README.md"), "utf8");

/** The first group `pattern` finds in `text`; throws when it finds none, so a changed README fails the build. */
function found(text: string, pattern: RegExp, what: string): string {
  const match = pattern.exec(text)?.[1];
  if (!match) throw new Error(`Not found: ${what}.`);
  return match;
}

/** The packages the pages describe, at the versions this site installs.
 * @example <PackageVersions />
 */
export function PackageVersions() {
  const rows: [string, string][] = [
    ["@ingestron/cli", "the `ingestron` command"],
    ["@ingestron/definitions", "loading and resolving definitions"],
    ["@ingestron/authoring", "editor features"],
    ...packs.map((pack): [string, string] => [
      `@ingestron/pack-${pack.id}`,
      `${packName(pack.id)} pack, \`${pack.id}@${pack.version}\``,
    ]),
  ];
  return (
    <table>
      <thead>
        <tr>
          <th>Package</th>
          <th>What it is</th>
          <th>Version</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, what]) => (
          <tr key={name}>
            <td>
              <code>{name}</code>
            </td>
            <td>
              <Inline text={what} />
            </td>
            <td>{installed(name).version}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** What each pack's output was checked against, as the installed pack records it.
 * @example <PlatformChecks />
 */
export function PlatformChecks() {
  const databricks = readme("@ingestron/pack-databricks");
  const duckdb = installed("@ingestron/pack-duckdb").devDependencies?.["@duckdb/node-api"];
  if (!duckdb) throw new Error("Not found: the DuckDB the DuckDB pack's tests use.");
  const rows: [string, string][] = [
    [
      "databricks",
      `The bundle schema of Databricks CLI ${found(databricks, /Databricks CLI (v[\d.]+)/, "the Databricks CLI version")} (\`databricks bundle schema\`) and the Databricks documentation, accessed ${found(databricks, /## Sources \(accessed ([\d-]+)\)/, "the Databricks access date")}`,
    ],
    [
      "adf",
      "Microsoft Learn's Data Factory pages, listed with the date each was checked under [Native configuration sources](/docs/reference/packs/adf#native-configuration-sources)",
    ],
    [
      "synapse",
      `Microsoft Learn's Synapse serverless SQL pages, accessed ${found(readme("@ingestron/pack-synapse"), /Microsoft Learn, accessed ([\d-]+)/, "the Synapse access date")}`,
    ],
    [
      "duckdb",
      `DuckDB ${duckdb.replace(/-r\.\d+$/, "")}, which runs the SQL the pack writes in its tests`,
    ],
  ];
  return (
    <table>
      <thead>
        <tr>
          <th>Pack</th>
          <th>Checked against</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([pack, checked]) => (
          <tr key={pack}>
            <td>
              <a href={`/docs/reference/packs/${pack}`}>{packName(pack)}</a>
            </td>
            <td>
              <Inline text={checked} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The packs the site documents, by name, each linking to its reference page.
 * @example The distribution includes the <PackNames /> packs.
 */
export function PackNames() {
  const names = packs.map((pack) => (
    <a key={pack.id} href={`/docs/reference/packs/${pack.id}`}>
      {packName(pack.id)}
    </a>
  ));
  return (
    <>
      {names.map((name, index) => (
        <span key={index}>
          {index === 0 ? "" : index === names.length - 1 ? " and " : ", "}
          {name}
        </span>
      ))}
    </>
  );
}
