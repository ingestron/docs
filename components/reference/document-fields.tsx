// A document kind's fields at every depth, from its JSON Schema.
import { contractReads, type FieldInfo } from "@ingestron/definitions";
import { documentFields, packName, platformSectionFields } from "@/lib/reference";
import { Meaning, Name } from "./field-rows";
import { TableFrame } from "@/components/table-frame";

type Kind = Parameters<typeof documentFields>[0];

/** Every field of one document kind; `*` stands for any name or list item. */
export function DocumentFields({ kind }: { kind: Kind }) {
  return <FieldTable label={`Fields of ${kind}`} fields={documentFields(kind)} />;
}

/** A contract's fields: those Ingestron reads, then every other ODCS field, folded. */
export function ContractFields() {
  const fields = documentFields("DataContract");
  const read = (field: FieldInfo) => contractReads.includes(field.path.join("."));
  return (
    <>
      <FieldTable label="Contract fields Ingestron reads" fields={fields.filter(read)} />
      <details>
        <summary>Every other field of ODCS v3.1.0</summary>
        <FieldTable
          label="Every other field of ODCS v3.1.0"
          fields={fields.filter((field) => !read(field))}
        />
      </details>
    </>
  );
}

/** The fields of a pack's own section of the Platform, written under the pack's id.
 * @example <PlatformSection pack="databricks" />
 */
export function PlatformSection({ pack }: { pack: string }) {
  const fields = platformSectionFields(pack);
  if (fields.length === 0) throw new Error(`The ${pack} pack's Platform section has no fields.`);
  return <FieldTable label={`The ${packName(pack)} section of the Platform`} fields={fields} />;
}

export function FieldTable({ label, fields }: { label: string; fields: FieldInfo[] }) {
  return (
    <TableFrame label={label}>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.docs}>
              <Name field={field} />
              <td>{field.type}</td>
              <td>
                <Meaning field={field} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}
