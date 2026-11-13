// A connector's whole page, from the packs' and the CLI's metadata. A
// connector's own notes come from its MDX file as <ConnectorNote at="…">
// children, and are placed in the slot they name. Headings are MDX's own
// Heading, so a jump to one clears the sticky header and offers its link.
import { Heading } from "fumadocs-ui/components/heading";
import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { Example } from "@/components/example";
import { FlowDiagram } from "@/components/flow-diagram";
import {
  connectorExample,
  connectorSections,
  connectorSlots,
  settingsAnchor,
  watermarkExample,
  type Part,
  type Section,
} from "@/lib/connector-page";
import { ConnectorFacts } from "./connector-facts";
import { ConnectorSettings } from "./connector-settings";
import { ExamplesList } from "./examples-list";
import { Inline } from "./inline";
import { NativeReadSettings } from "./native-read-settings";
import { ConnectorRecipes } from "./recipes";
import { SettingsSections } from "./settings-sections";

/** Words only one connector needs, placed in one of its page's slots.
 * @example <ConnectorNote at="adf-connection">### Choose authentication [#adf-authentication] …</ConnectorNote>
 */
export function ConnectorNote({ children }: { at: string; children?: ReactNode }) {
  return <>{children}</>;
}

/** One connector's page: its routes, how to connect and read with each pack, and examples.
 * @example <ConnectorPage id="sqlserver" />
 */
export function ConnectorPage({ id, children }: { id: string; children?: ReactNode }) {
  const notes = Children.toArray(children).map((child) => {
    const at = isValidElement<{ at?: string }>(child) ? child.props.at : undefined;
    if (!at)
      throw new Error(`connectors/${id}: only <ConnectorNote at="…"> goes in ConnectorPage.`);
    return { at, child };
  });
  const slots = connectorSlots(id);
  const unknown = notes.filter((note) => !slots.includes(note.at)).map((note) => note.at);
  if (unknown.length > 0)
    throw new Error(`connectors/${id}: no slot ${unknown.join(", ")} on this page.`);
  const slot = (name: string) => notes.filter((note) => note.at === name).map((note) => note.child);
  const sections = connectorSections(id);
  const first = sections.find((section) => section.entry)!;
  return (
    <>
      {sections.map((section) => (
        <Fragment key={section.id}>
          <Heading as="h2" id={section.id}>
            {section.title}
          </Heading>
          <Paragraphs texts={section.before} />
          {section.id === "routes" && <ConnectorFacts id={id} />}
          {section.id === "source-metadata" && <ConnectorRecipes id={id} />}
          {section.id === "examples" && <ExamplesList connector={id} />}
          {section.items.map((item) =>
            "slot" in item ? (
              <div key={item.slot}>{slot(item.slot)}</div>
            ) : (
              <div key={item.part.id}>
                <Heading as="h3" id={item.part.id}>
                  {item.part.title}
                </Heading>
                <Paragraphs texts={item.part.before} />
                {item.part.routes && item.part.routes.length > 0 && (
                  <ul>
                    {item.part.routes.map((route) => (
                      <li key={route.via}>
                        <a href={route.guide}>{route.title}</a> (<code>{route.via}</code>):{" "}
                        <Inline text={route.text} />
                      </li>
                    ))}
                  </ul>
                )}
                <Shown id={id} part={item.part} section={section} first={section === first} />
                <Paragraphs texts={item.part.after} />
                {item.part.slot && slot(item.part.slot)}
              </div>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}

function Paragraphs({ texts }: { texts: string[] }) {
  return texts.map((text) => (
    <p key={text}>
      <Inline text={text} />
    </p>
  ));
}

/** What a part shows after its words: an example, a diagram or settings. */
function Shown({
  id,
  part,
  section,
  first,
}: {
  id: string;
  part: Part;
  section: Section;
  first: boolean;
}) {
  const { pack, connector } = section.entry ?? {};
  if (!pack || !connector) return null;
  const example = () => connectorExample(id, pack);
  switch (part.kind) {
    case "example":
      return <Example {...example().connection} />;
    case "encryption":
      return (
        <SettingsSections pack={pack} method={connector.method} include={["encrypt"]} level={4} />
      );
    case "fields":
      return (
        <ConnectorSettings
          id={id}
          pack={pack}
          sample={example().connection.name}
          file={example().connection.file}
          anchor={first ? settingsAnchor : undefined}
          prefix={`${pack}-connection-`}
        />
      );
    case "tables":
      return <Example {...example().flow} />;
    case "reading":
      return connector.method === "adf-copy" ? (
        <FlowDiagram
          title="An incremental window"
          steps={[
            { title: "Window start", detail: "Inclusive: watermark ≥ start" },
            { title: "Rows in the window", detail: "Only matching rows are copied" },
            { title: "Window end", detail: "Exclusive: watermark < end" },
          ]}
        />
      ) : null;
    case "watermarks":
      return (
        <>
          <Example name={watermarkExample} file="standard.yaml" />
          <Example name={watermarkExample} file="flows/erp.yaml" />
        </>
      );
    case "settings":
      return connector.reading ? (
        <NativeReadSettings id={id} level={4} />
      ) : (
        <SettingsSections pack={pack} method={connector.method} connector={id} level={4} />
      );
    default:
      return null;
  }
}
