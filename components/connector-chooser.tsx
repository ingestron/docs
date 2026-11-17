// The page at a connector's old URL, /docs/connectors/<id>, which the CLI and
// the editor link to: each platform that loads the connector has its own page.
import { PlatformChooserLinks } from "@/components/platform-choice";
import { platforms } from "@/lib/platforms";
import { connectorsFor } from "@/lib/reference";

/**
 * Links to each platform's page for a connector, or, without `id`, to each
 * platform's list of connectors.
 * @example <ConnectorChooser id="sqlserver" />
 */
export function ConnectorChooser({ id }: { id?: string }) {
  const versions = platforms
    .filter((platform) =>
      id ? connectorsFor(platform.id).includes(id) : connectorsFor(platform.id).length > 0,
    )
    .map((platform) => platform.id);
  if (versions.length === 0) throw new Error(`ConnectorChooser: no platform loads "${id}".`);
  return (
    <>
      <p>
        {id
          ? "Each platform that loads this source has its own page. Choose yours:"
          : "Each platform has its own list of the sources it loads. Choose yours:"}
      </p>
      <PlatformChooserLinks page={id ? `connectors/${id}` : "connectors"} versions={versions} />
    </>
  );
}
