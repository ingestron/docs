// The column type each pack gives a contract's logicalType, from the packs' own defaults.
import type { Platform } from "@/lib/platforms";
import { packName, packs, platformUsedPacks } from "@/lib/reference";
import { TableFrame } from "@/components/table-frame";

/** The logical types of ODCS v3.1.0, in the order the contract notes explain them. */
const logicalTypes = [
  "string",
  "integer",
  "number",
  "boolean",
  "date",
  "timestamp",
  "time",
  "object",
  "array",
];

/** One row per logical type, one column per pack that types tables; with
 * `platform`, only the packs that platform's routes use.
 * @example <ContractTypes platform="synapse" />
 */
export function ContractTypes({ platform }: { platform?: Platform["id"] }) {
  const used = platform && platformUsedPacks(platform);
  const typed = packs.filter(
    (pack) => Object.keys(pack.defaults.types ?? {}).length > 0 && (!used || used.has(pack.id)),
  );
  if (typed.length === 0) throw new Error(`No pack types tables on ${platform}.`);
  return (
    <TableFrame label="Each logical type, by pack">
      <table>
        <thead>
          <tr>
            <th>
              <code>logicalType</code>
            </th>
            {typed.map((pack) => (
              <th key={pack.id}>{packName(pack.id)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logicalTypes.map((type) => (
            <tr key={type}>
              <td>
                <code>{type}</code>
              </td>
              {typed.map((pack) => {
                const found = pack.defaults.types?.[type];
                return <td key={pack.id}>{found ? <code>{found}</code> : "no default"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}
