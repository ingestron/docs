// The names and layers each pack gives a project whose standard sets none, from the packs' own defaults.
import type { Naming } from "@ingestron/definitions";
import { packName, packs } from "@/lib/reference";
import { TableFrame } from "@/components/table-frame";

/** The patterns a standard's `naming` can set, in the order the document reference lists them. */
const names: (keyof Naming)[] = ["catalog", "schema", "table", "pipeline", "job"];

/**
 * The packs whose names reach what they write. The ADF pack names its
 * factory's resources with its methods' `resource_names` instead, so its
 * naming defaults name nothing it generates.
 */
const naming = () => packs.filter((pack) => pack.id !== "adf");

/** One row per name, one column per pack that names tables.
 * @example <PackNaming />
 */
export function PackNaming() {
  return (
    <TableFrame label="Default names, by pack">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            {naming().map((pack) => (
              <th key={pack.id}>{packName(pack.id)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((name) => (
            <tr key={name}>
              <td>
                <code>{name}</code>
              </td>
              {naming().map((pack) => (
                <td key={pack.id}>
                  <code>{pack.defaults.naming[name]}</code>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

/** The layers every pack gives by default, for a sentence; the build fails if the packs disagree.
 * @example Without `layers`, a project has <DefaultLayers />.
 */
export function DefaultLayers() {
  const [first, ...others] = packs.map((pack) => pack.defaults.layers.join(","));
  if (others.some((layers) => layers !== first))
    throw new Error("The packs' default layers differ; the page must name each pack's.");
  const layers = first!.split(",");
  return (
    <>
      {layers.map((layer, index) => (
        <span key={layer}>
          {index === 0 ? "" : index === layers.length - 1 ? " and " : ", "}
          <code>{layer}</code>
        </span>
      ))}
    </>
  );
}
