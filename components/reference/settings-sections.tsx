// Section-sized slices of the existing reference, without copying its facts.
import { ingestionRows } from "@/lib/connector-settings";
import type { FieldInfo } from "@ingestron/definitions";
import { anchorId, fieldPath, packs, settingRows, shown } from "@/lib/reference";
import { Meaning } from "./field-rows";

const homes = {
  platform: "platform settings",
  standard: "standard settings",
};

/** Explain method settings as sections. Prefixes include nested fields.
 * @example <SettingsSections pack="adf" method="adf-copy" include={["mode", "watermark_column"]} />
 */
export function SettingsSections({
  pack,
  method,
  include,
  connector,
  exclude = [],
  level = 3,
}: {
  pack: string;
  method: string;
  include?: string[];
  connector?: string;
  exclude?: string[];
  /** The heading level of each setting: 4 under a part that has its own heading. */
  level?: 3 | 4;
}) {
  const available = connector ? ingestionRows(connector, pack) : settingRows(pack, method);
  const rows = available.filter((field) => {
    const path = fieldPath(field);
    const matches = (prefix: string) => path === prefix || path.startsWith(`${prefix}.`);
    return (!include || include.some(matches)) && !exclude.some(matches);
  });
  return (
    <div className="setting-sections">
      <SettingPlacement fields={rows} action={actionOf(pack, method, connector)} />
      {rows.length > 3 && <SettingLinks fields={rows} />}
      {rows.map((field) => (
        <SettingSection key={field.docs} field={field} level={level} />
      ))}
    </div>
  );
}

function SettingSection({ field, level }: { field: FieldInfo; level: 3 | 4 }) {
  const Heading = level === 4 ? "h4" : "h3";
  return (
    <section id={anchorId(field)}>
      <header className="setting-heading">
        <Heading>
          <a href={`#${anchorId(field)}`}>
            <code>{fieldPath(field)}</code>
          </a>
        </Heading>
        <span className="setting-meta">
          {field.required && "Required"}
          {field.default !== undefined && (
            <>
              {" "}
              {field.required && " · "}Default: <code>{shown(field.default)}</code>
            </>
          )}
        </span>
      </header>
      <div>
        <Meaning field={field} />
      </div>
    </section>
  );
}

function SettingLinks({ fields }: { fields: FieldInfo[] }) {
  return (
    <ul aria-label="Settings in this section">
      {fields.map((field) => (
        <li key={field.docs}>
          <a href={`#${anchorId(field)}`}>
            <code>{fieldPath(field)}</code>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The action whose `with` holds a definition's settings: a connector's are ingest's. */
function actionOf(pack: string, method: string, connector?: string): string {
  if (connector) return "ingest";
  return packs.find((candidate) => candidate.id === pack)?.methods[method]?.action ?? "ingest";
}

function SettingPlacement({ fields, action }: { fields: FieldInfo[]; action: string }) {
  const places = [...new Set(fields.map((field) => field.placement))]
    .filter((home) => home !== undefined)
    .map((home) =>
      home === "definition"
        ? `the flow's or a table's ${action}.with`
        : homes[home as keyof typeof homes],
    );
  return (
    <p className="setting-meta">
      Configure these fields in {places.join(" or ")}. See{" "}
      <a href="/docs/concepts/settings">how settings are resolved</a> for overrides.
    </p>
  );
}
