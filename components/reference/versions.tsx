// The versions this site is built with, read from the installed packages.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packName, packs } from "@/lib/reference";
import { Inline } from "./inline";
import extension from "./vscode-extension.json";
import { TableFrame } from "@/components/table-frame";

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
    ["@ingestron/core", "the API the command is built on"],
    ["@ingestron/definitions", "loading and resolving definitions"],
    ["@ingestron/authoring", "editor features"],
    [
      "@ingestron/standards",
      "the [published standards](/docs/how-to/choose-a-published-standard) installed with the command",
    ],
    ...packs.map((pack): [string, string] => [
      `@ingestron/pack-${pack.id}`,
      `${packName(pack.id)} pack, \`${pack.id}@${pack.version}\``,
    ]),
  ];
  return (
    <TableFrame label="Package versions">
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
    </TableFrame>
  );
}

/** The DuckDB version that runs the DuckDB pack's SQL in its tests, such as `1.5.6`. */
function duckdbTested(): string {
  const duckdb = installed("@ingestron/pack-duckdb").devDependencies?.["@duckdb/node-api"];
  if (!duckdb) throw new Error("Not found: the DuckDB the DuckDB pack's tests use.");
  if (!/^\d+\.\d+\.\d+(-r\.\d+)?$/.test(duckdb))
    throw new Error(`Not an exact version: the DuckDB pack's @duckdb/node-api is ${duckdb}.`);
  return duckdb.replace(/-r\.\d+$/, "");
}

/** The DuckDB version the DuckDB pack's tests run its SQL with, for a sentence.
 * @example The pack's SQL is tested with DuckDB <DuckdbTested />.
 */
export function DuckdbTested() {
  return <>{duckdbTested()}</>;
}

/** What each pack's output was checked against, as the installed pack records it.
 * @example <PlatformChecks />
 */
export function PlatformChecks() {
  const databricks = readme("@ingestron/pack-databricks");
  const rows: [string, string][] = [
    [
      "databricks",
      `The bundle schema of Databricks CLI ${found(databricks, /Bundle fields\s+from Databricks CLI (v[\d.]+)/, "the Databricks CLI version")} (\`databricks bundle schema\`) and the Databricks documentation, accessed ${found(databricks, /## Sources\n[\s\S]*?\(accessed ([\d-]+)\)/, "the Databricks access date")}`,
    ],
    [
      "adf",
      "Microsoft Learn's Data Factory pages, listed with the date each was checked under [Native configuration sources](/docs/reference/packs/adf#native-configuration-sources)",
    ],
    [
      "synapse",
      `Microsoft Learn's Synapse serverless SQL pages, accessed ${found(readme("@ingestron/pack-synapse"), /Microsoft Learn, accessed ([\d-]+)/, "the Synapse access date")}`,
    ],
    ["duckdb", `DuckDB ${duckdbTested()}, which runs the SQL the pack writes in its tests`],
  ];
  return (
    <TableFrame label="What each pack was checked against">
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
    </TableFrame>
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

/** The VS Code extension's version, as `pnpm sync:vscode` last copied it.
 * @example <ExtensionVersion />
 */
export function ExtensionVersion() {
  return <>{extension.version}</>;
}
