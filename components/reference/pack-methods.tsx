// Every method of a pack: what it does, what it reads and hands over, the
// intent it gives and the settings that are other names for intent, and its
// settings.
import { aliasTexts, intentPairs, packOf } from "@/lib/reference";
import { Inline } from "./inline";
import { SettingsTable } from "./settings-table";

/** One section per method, with an id the connector pages link to. */
export function PackMethods({ pack }: { pack: string }) {
  const found = packOf(pack);
  return (
    <>
      {Object.entries(found.methods).map(([id, method]) => {
        const defaults = method.intentDefaults ? intentPairs(method.intentDefaults) : [];
        const aliases = aliasTexts(pack, id);
        return (
          <section key={id}>
            <h3 id={id}>
              <code>{id}</code> ({method.action})
            </h3>
            <p>{method.description}</p>
            <ul>
              {method.connectors && <li>Reads: {method.connectors.join(", ")}</li>}
              {method.connectivity && <li>Connectivity: {method.connectivity.join(", ")}</li>}
              {method.accepts && <li>Accepts: {method.accepts.join(", ")}</li>}
              <li>Hands over: {method.produces}</li>
              {defaults.length > 0 && (
                <li>
                  <Inline
                    text={`Intent it gives when nothing declares it: ${defaults.map((pair) => `\`${pair}\``).join(", ")}`}
                  />
                </li>
              )}
              {aliases.length > 0 && (
                <li>
                  <Inline
                    text={`Settings that are [intent](/docs/reference/intent#settings-that-are-intent): ${aliases.join("; ")}`}
                  />
                </li>
              )}
            </ul>
            <SettingsTable pack={pack} method={id} />
          </section>
        );
      })}
    </>
  );
}
