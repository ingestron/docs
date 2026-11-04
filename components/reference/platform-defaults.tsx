// A pack's platform defaults, from the Platform document's own descriptions,
// the text the editor shows, so the reference and the editor agree.
import { anchorId, fieldPath, platformDefaults } from "@/lib/reference";
import { Inline } from "./inline";
import { TableFrame } from "@/components/table-frame";

/** Each Platform field the pack reads, with its default, linked to the field's reference.
 * @example <PlatformDefaults pack="databricks" />
 */
export function PlatformDefaults({ pack }: { pack: string }) {
  return (
    <TableFrame label={`Platform defaults the ${pack} pack uses`}>
      <table>
        <thead>
          <tr>
            <th>Setting</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          {platformDefaults(pack).map(({ field, default: stated }) => (
            <tr key={anchorId(field)}>
              <td>
                <a href={field.docs}>
                  <code>{fieldPath(field)}</code>
                </a>
              </td>
              <td>
                <Inline text={stated} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}
