// What each pack does with each intent path and value, from the pack's own
// `intent` declarations: the support matrix on each pack's page, the methods
// that differ from their pack, and an overview of every pack for the intent
// reference. Nothing here is written by hand.
import type { FeatureStatus, IntentUse } from "@ingestron/definitions";
import { intentPaths } from "@ingestron/definitions";
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
 * uses it, what it does or why not, and, where it is used, the platform
 * feature's release level and the date it was checked. Then each method whose
 * own entries differ from the pack's.
 * @example <IntentSupport pack="databricks" />
 */
export function IntentSupport({ pack }: { pack: string }) {
  const name = packName(pack);
  const methods = methodIntentRows(pack);
  return (
    <>
      <TableFrame label={`What the ${name} pack does with each intent value`}>
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
            {intentRows(pack).map(({ path, values, use }) => (
              <tr key={`${path}=${values.join(",")}`}>
                <td>
                  <code>{path}</code>
                </td>
                <td>
                  <Values values={values} />
                </td>
                <td>{uses[use.use]}</td>
                <td>
                  <Inline text={said(use)} />
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
          <TableFrame label={`Where a ${name} method differs`}>
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
                      <Inline text={said(use)} />
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
          {intentVocabulary().map(({ path, field, values, places }) => (
            <tr key={path} id={`intent-${path.replaceAll(/[^a-z0-9]+/g, "-")}`}>
              <td>
                <a href={field.docs}>
                  <code>{path}</code>
                </a>
              </td>
              <td>
                {field.description && <Inline text={field.description} />}
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
