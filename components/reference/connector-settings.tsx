// Descriptions and values come from the same metadata as editor help.
import type { Connector } from "@ingestron/definitions";
import { parse } from "yaml";
import { readExampleFile } from "@/lib/examples";
import { connectorEntries, shown } from "@/lib/reference";
import { FindAndSuggest } from "./field-rows";
import { Inline } from "./inline";

interface Props {
  id: string;
  pack: string;
  sample?: string;
  file?: string;
  /** The id of the whole list, for links to every field at once. */
  anchor?: string;
  /** Each field's id is this and its name, so two packs' fields on one page differ. */
  prefix: string;
}

/** Field explanations with values from the displayed, validated sample.
 * @example <ConnectorSettings id="sqlserver" pack="adf" prefix="adf-connection-" />
 */
export function ConnectorSettings({ id, pack, sample, file, anchor, prefix }: Props) {
  const connector = connectorEntries(id).find((entry) => entry.pack === pack)?.connector;
  if (!connector) throw new Error(`No ${pack} connector ${id}`);
  const example = sample && file ? parse(readExampleFile(sample, file)).settings : {};
  return (
    <div className="setting-sections" id={anchor}>
      <p>
        These fields go under <code>settings</code> in the connection YAML. Optional fields may
        become required when you choose a particular authentication option; the conditions are
        described below.
      </p>
      {connector.reading?.runtime && (
        <p>
          This source requires <code>runtime_kind: {connector.reading.runtime}</code> in the
          platform's method settings. Name the matching runtime in <code>integration_runtime</code>.
        </p>
      )}
      <ul aria-label="Connection settings">
        {connector.settings.map((setting) => (
          <li key={setting.name}>
            <a href={`#${prefix}${setting.name}`}>
              <code>{setting.name}</code>
            </a>
          </li>
        ))}
      </ul>
      {connector.settings.map((setting) => (
        <ConnectionField
          key={setting.name}
          id={`${prefix}${setting.name}`}
          setting={setting}
          example={example?.[setting.name]}
        />
      ))}
    </div>
  );
}

type Setting = Connector["settings"][number];

function ConnectionField({
  id,
  setting,
  example,
}: {
  id: string;
  setting: Setting;
  example: unknown;
}) {
  return (
    <section id={id}>
      <header className="setting-heading">
        <h4>
          <a href={`#${id}`}>
            <code>{setting.name}</code>
          </a>
        </h4>
        <span className="setting-meta">
          {[!setting.optional && "Required", setting.type].filter(Boolean).join(" · ")}
        </span>
      </header>
      <p>
        <Inline text={setting.description} />
      </p>
      <ConnectionValues setting={setting} />
      {(setting.find || setting.suggest) && (
        <p>
          <FindAndSuggest find={setting.find} suggest={setting.suggest} />
        </p>
      )}
      {example !== undefined && (
        <p>
          In the example: <code>{shown(example)}</code>.
        </p>
      )}
    </section>
  );
}

function ConnectionValues({ setting }: { setting: Setting }) {
  return (
    <>
      {setting.values && (
        <p>
          Accepted values:{" "}
          {setting.values.map((value, index) => (
            <span key={value}>
              {index > 0 && ", "}
              <code>{value}</code>
            </span>
          ))}
          .
        </p>
      )}
      {setting.secret && (
        <p>
          Use a <code>{"${secret:name}"}</code> reference to a Key Vault secret. Keep the secret
          value out of the YAML.
        </p>
      )}
    </>
  );
}
