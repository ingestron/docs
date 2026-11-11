// Rows of described fields: what each is, its values with their meanings, its
// default, an example, and where to find a value with a suggestion, as the
// editor's hover says them. Each row has the anchor the editor links to.
import type { FieldInfo } from "@ingestron/definitions";
import { anchorId, fieldPath, shown } from "@/lib/reference";
import { Inline } from "./inline";

/** The meaning column: description, allowed values with meanings, example, where to find it and a suggestion. */
export function Meaning({ field }: { field: FieldInfo }) {
  const described = field.values ?? [];
  return (
    <>
      {field.description && <Inline text={field.description} />}
      {described.length === 1 && !described[0]!.description && (
        <>
          {" "}
          Accepted value: <code>{String(described[0]!.value)}</code>.
        </>
      )}
      {(described.length > 1 || described[0]?.description) && (
        <ul>
          {described.map((item) => (
            <li key={String(item.value)}>
              <code>{String(item.value)}</code>
              {item.description && (
                <>
                  : <Inline text={item.description} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {field.example !== undefined && (
        <>
          {" "}
          For example: <code>{shown(field.example)}</code>.
        </>
      )}
      <FindAndSuggest find={field.find} suggest={field.suggest} />
    </>
  );
}

/** Where the owner finds a value, and what it could look like, each on a line of its own. */
export function FindAndSuggest({ find, suggest }: { find?: string; suggest?: string }) {
  return (
    <>
      {find && (
        <span className="field-help">
          Where to find it: <Inline text={find} />
        </span>
      )}
      {suggest && (
        <span className="field-help">
          Suggested: <code>{suggest}</code>
        </span>
      )}
    </>
  );
}

/** The field's name cell, with its anchor. */
export function Name({ field }: { field: FieldInfo }) {
  return (
    <td id={anchorId(field)}>
      <code>{fieldPath(field)}</code>
      {field.required && " (required)"}
    </td>
  );
}
