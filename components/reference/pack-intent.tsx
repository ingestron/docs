// What each pack does with each intent path and value, from the pack's own
// `intent` declarations: the support matrix on each pack's page, the methods
// that differ from their pack, and an overview of every pack for the intent
// reference. Nothing here is written by hand.
import type { FeatureStatus, IntentUse } from "@ingestron/definitions";
import { intentPaths, intentUseOf } from "@ingestron/definitions";
import {
  aliasTexts,
  intentRows,
  intentVocabulary,
  methodIntentRows,
  packName,
  packOf,
  packs,
} from "@/lib/reference";
import { Inline } from "./inline";
import { TableFrame } from "@/components/table-frame";

const uses = {
  used: "Used",
  "not-yet": "Not yet",
  elsewhere: "Elsewhere",
  "not-applicable": "Not applicable",
} as const;

/** What the entry says: what the pack does, or why it does not. */
function said(use: IntentUse): string {
  return use.use === "used" ? use.does : use.reason;
}

/**
 * Where a used entry applies only in some layers, and the time zones it
 * cannot convert, as sentences after what it does.
 */
function limits(use: IntentUse, shown?: string): string[] {
  if (use.use !== "used") return [];
  const found: string[] = [];
  if (use.onlyWhere === shown) {
    // Said once for the whole table.
  } else if (use.onlyWhere === "check")
    found.push("Only in a layer whose `does` lists `check`; a `raw` layer only counts.");
  else if (use.onlyWhere) found.push(`Only in a layer whose \`does\` lists \`${use.onlyWhere}\`.`);
  const zones = Object.keys(use.zonesNotApplied ?? {});
  if (zones.length > 0)
    found.push(`Not from or to ${zones.map((zone) => `\`${zone}\``).join(", ")}.`);
  return found;
}

/**
 * What the entry says, with the layers it applies in and the zones it cannot
 * convert; `shown` is a layer duty a table has already said its entries need.
 */
function Said({ use, shown }: { use: IntentUse; shown?: string }) {
  return <Inline text={[said(use), ...limits(use, shown)].join(" ")} />;
}

/** The quality and cleansing paths, which each pack's page lists apart from the rest of intent. */
export function isQualityPath(path: string): boolean {
  return path.startsWith("quality.") || path.startsWith("cleanse.") || path === "deduplicate";
}

/** A value as the vocabulary writes it; `*` is any text, such as a column's name. */
function Values({ values }: { values: string[] }) {
  if (values.length === 1 && values[0] === "*") return <>any</>;
  return (
    <>
      {values.map((value, index) => (
        <span key={value}>
          {index > 0 && ", "}
          <code>{value}</code>
        </span>
      ))}
    </>
  );
}

/** The platform feature's release level, linked to the page that says so. */
function Release({ status }: { status?: FeatureStatus }) {
  if (!status) return null;
  const words = status.level === "ga" ? "Generally available" : (status.label ?? "In preview");
  return <a href={status.source}>{words}</a>;
}

/**
 * The pack's support matrix: each intent path and value, whether the pack
 * uses it, what it does or why not, the layers it applies in, and, where it is
 * used, the platform feature's release level, linked to the page that says so,
 * and the date it was checked. Then each method whose own entries differ from
 * the pack's. `part="quality"` keeps only the quality and cleansing paths;
 * without it, they are left out, for the page's section of their own.
 * @example <IntentSupport pack="databricks" />
 * @example <IntentSupport pack="synapse" part="quality" />
 */
export function IntentSupport({ pack, part }: { pack: string; part?: "quality" }) {
  const name = packName(pack);
  const kept = (path: string) => isQualityPath(path) === (part === "quality");
  const methods = methodIntentRows(pack).filter((row) => kept(row.path));
  const what = part === "quality" ? "quality and cleansing value" : "intent value";
  return (
    <>
      <TableFrame label={`What the ${name} pack does with each ${what}`}>
        <table>
          <thead>
            <tr>
              <th>Intent</th>
              <th>Value</th>
              <th>Use</th>
              <th>What the pack does, or why not</th>
              <th>Release</th>
              <th>Checked</th>
            </tr>
          </thead>
          <tbody>
            {intentRows(pack)
              .filter((row) => kept(row.path))
              .map(({ path, values, use }) => (
                <tr key={`${path}=${values.join(",")}`}>
                  <td>
                    <code>{path}</code>
                  </td>
                  <td>
                    <Values values={values} />
                  </td>
                  <td>{uses[use.use]}</td>
                  <td>
                    <Said use={use} />
                  </td>
                  <td>{use.use === "used" && <Release status={use.status} />}</td>
                  <td>{use.use === "used" && use.status?.checked}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </TableFrame>
      {methods.length > 0 && (
        <>
          <p>Where a method differs from the pack, its own entry wins for the tables it builds:</p>
          <TableFrame
            label={`Where a ${name} method differs${part === "quality" ? " in quality and cleansing" : ""}`}
          >
            <table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Intent</th>
                  <th>Value</th>
                  <th>Use</th>
                  <th>What the method does, or why not</th>
                  <th>Release</th>
                </tr>
              </thead>
              <tbody>
                {methods.map(({ method, path, value, use }) => (
                  <tr key={`${method} ${path}=${value ?? ""}`}>
                    <td>
                      <a href={`#${method}`}>
                        <code>{method}</code>
                      </a>
                    </td>
                    <td>
                      <code>{path}</code>
                    </td>
                    <td>{value === undefined ? "every value" : <Values values={[value]} />}</td>
                    <td>{uses[use.use]}</td>
                    <td>
                      <Said use={use} />
                    </td>
                    <td>{use.use === "used" && <Release status={use.status} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        </>
      )}
    </>
  );
}

/** One word per pack for one intent value: used (and in preview), or not. */
function Cell({ use }: { use: IntentUse }) {
  if (use.use !== "used") return <>{uses[use.use]}</>;
  return (
    <>
      Used
      {use.status?.level === "preview" && <> ({use.status.label ?? "in preview"})</>}
    </>
  );
}

/**
 * Every intent path and value, and what each pack does with it, in one word;
 * each pack's name links to its full matrix. `only` keeps some, each written
 * `path=value`, or `path` for every value of it; `packs` keeps some packs.
 * @example <IntentOverview />
 * @example <IntentOverview only={["history=latest", "history=full"]} packs={["duckdb", "databricks"]} />
 */
export function IntentOverview({ only, packs: shown }: { only?: string[]; packs?: string[] }) {
  const columns = shown ? shown.map(packOf) : packs;
  const rows = Object.fromEntries(columns.map((pack) => [pack.id, intentRows(pack.id)]));
  const useOf = (pack: string, path: string, value: string) =>
    rows[pack]!.find((row) => row.path === path && row.values.includes(value))!.use;
  const kept = Object.entries(intentPaths).flatMap(([path, values]) =>
    values
      .filter((value) => !only || only.includes(path) || only.includes(`${path}=${value}`))
      .map((value) => ({ path, value })),
  );
  if (only && kept.length === 0) throw new Error(`No intent matches ${only.join(", ")}.`);
  return (
    <TableFrame label="What each pack does with each intent value">
      <table>
        <thead>
          <tr>
            <th>Intent</th>
            <th>Value</th>
            {columns.map((pack) => (
              <th key={pack.id}>
                <a href={`/docs/reference/packs/${pack.id}#intent`}>{packName(pack.id)}</a>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kept.map(({ path, value }) => (
            <tr key={`${path}=${value}`}>
              <td>
                <code>{path}</code>
              </td>
              <td>
                <Values values={[value]} />
              </td>
              {columns.map((pack) => (
                <td key={pack.id}>
                  <Cell use={useOf(pack.id, path, value)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

/**
 * The intent vocabulary: each path, what it means, its values with their
 * meanings, and where it can be written, from the documents' own fields.
 * @example <IntentVocabulary />
 */
export function IntentVocabulary() {
  return (
    <TableFrame label="Intent paths and values">
      <table>
        <thead>
          <tr>
            <th>Intent</th>
            <th>Meaning and values</th>
            <th>Written in</th>
          </tr>
        </thead>
        <tbody>
          {intentVocabulary().map(({ path, field, description, values, places }) => (
            <tr key={path} id={`intent-${path.replaceAll(/[^a-z0-9]+/g, "-")}`}>
              <td>
                <a href={field.docs}>
                  <code>{path}</code>
                </a>
              </td>
              <td>
                {(description ?? field.description) && (
                  <Inline text={description ?? field.description!} />
                )}
                {values.length === 1 && values[0]!.value === "*" ? (
                  " Any value."
                ) : (
                  <ul>
                    {values.map(({ value, description }) => (
                      <li key={value}>
                        <code>{value}</code>
                        {description && (
                          <>
                            : <Inline text={description} />
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td>{places.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

/**
 * Every method setting that is another name for intent, by pack and method,
 * linked to the method's reference.
 * @example <IntentAliases />
 */
export function IntentAliases() {
  const rows = packs.flatMap((pack) =>
    Object.keys(pack.methods).flatMap((method) => {
      const texts = aliasTexts(pack.id, method);
      return texts.length > 0 ? [{ pack: pack.id, method, texts }] : [];
    }),
  );
  return (
    <TableFrame label="Method settings that are intent">
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Setting and the intent it means</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ pack, method, texts }) => (
            <tr key={`${pack} ${method}`}>
              <td>
                <a href={`/docs/reference/packs/${pack}#${method}`}>
                  <code>{method}</code>
                </a>{" "}
                ({packName(pack)})
              </td>
              <td>
                <ul>
                  {texts.map((text) => (
                    <li key={text}>
                      <Inline text={text} />
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

/**
 * The time zones a pack cannot convert from or to, each with its reason, from
 * its `cleanse.timezone` entry. Throws for a pack that lists none.
 * @example <ZonesNotApplied pack="synapse" />
 */
export function ZonesNotApplied({ pack }: { pack: string }) {
  const use = intentUseOf(packOf(pack), "cleanse.timezone", "true");
  const zones = Object.entries((use?.use === "used" && use.zonesNotApplied) || {});
  if (zones.length === 0) throw new Error(`The ${pack} pack converts every time zone.`);
  return (
    <TableFrame label={`Time zones the ${packName(pack)} pack cannot convert`}>
      <table>
        <thead>
          <tr>
            <th>Zone</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {zones.map(([zone, reason]) => (
            <tr key={zone}>
              <td>
                <code>{zone}</code>
              </td>
              <td>
                <Inline text={reason} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

/** The rows of the engine table: what a reader asks, and the intent path and value that answers it. */
const engineRows: { label: string; path: string; value: string }[] = [
  { label: "Where checks run", path: "quality.rules", value: "notNull" },
  { label: "`warn`", path: "quality.actions", value: "warn" },
  { label: "`drop`", path: "quality.actions", value: "drop" },
  { label: "`fail`", path: "quality.actions", value: "fail" },
  { label: "Table checks", path: "quality.table-checks", value: "true" },
  { label: "`pattern` rules", path: "quality.rules", value: "pattern" },
  { label: "`items` rules", path: "quality.rules", value: "items" },
  { label: "Quarantine", path: "quality.quarantine", value: "true" },
  { label: "Results", path: "quality.results", value: "true" },
];

/**
 * What each engine does with a table's checks, from each pack's own intent:
 * where they run, each action, table checks, the rule kinds an engine cannot
 * apply, quarantine and results. A value a pack does not apply says why.
 * @example <QualityEngines />
 */
export function QualityEngines({
  packs: shown = ["databricks", "duckdb", "synapse"],
}: {
  packs?: string[];
}) {
  return (
    <TableFrame label="What each engine does with a table's checks">
      <table>
        <thead>
          <tr>
            <th>Check</th>
            {shown.map((pack) => (
              <th key={pack}>
                <a href={`/docs/reference/packs/${pack}#quality-and-cleansing`}>{packName(pack)}</a>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {engineRows.map(({ label, path, value }, row) => (
            <tr key={`${path}=${value}`}>
              <td>
                <Inline text={label} />
              </td>
              {shown.map((pack) => {
                const use = intentUseOf(packOf(pack), path, value);
                if (!use) throw new Error(`The ${pack} pack says nothing about ${path}: ${value}.`);
                return (
                  <td key={pack}>
                    {use.use === "used" ? (
                      // The first row says where checks run; the others need not repeat it.
                      <Said use={use} shown={row === 0 ? undefined : "check"} />
                    ) : (
                      <>
                        Not applied: <Inline text={said(use)} />
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}
