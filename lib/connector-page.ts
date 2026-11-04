// One page per connector: its sections, their anchors, and the words that
// depend only on the pack, the method or the route. Facts come from the packs
// and the CLI; what only one connector needs is a note in its MDX file, placed
// in one of the page's slots.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoutes, projectSources } from "@ingestron/cli";
import type { TOCItemType } from "fumadocs-core/toc";
import { parse } from "yaml";
import { exampleFiles, listExamples, readExampleFile } from "./examples";
import { connectorEntries, packName, type ConnectorEntry } from "./reference";
import { routeGuides } from "./routes";

/** What a part of the page shows after its words. */
export type PartKind =
  | "access"
  | "example"
  | "encryption"
  | "fields"
  | "tables"
  | "reading"
  | "watermarks"
  | "settings"
  | "current";

/** A sub-section, with its heading, its words and, for some, a slot for notes without a heading. */
export interface Part {
  kind: PartKind;
  id: string;
  title: string;
  /** Paragraphs before what the part shows, with `code` and [links](/docs/…). */
  before: string[];
  /** One line per route the connector has, where the words differ by route. */
  routes?: { via: string; title: string; guide: string; text: string }[];
  /** Paragraphs after what the part shows. */
  after: string[];
  /** Notes placed here are paragraphs: they continue this part. */
  slot?: string;
}

/** A section's items in order: parts, and the slot for notes with their own headings. */
export type Item = { part: Part } | { slot: string };

/** One of the page's top-level sections. */
export interface Section {
  id: string;
  title: string;
  /** The pack and connector a Connect or Read section is about. */
  entry?: ConnectorEntry;
  before: string[];
  items: Item[];
}

/** A file of a sample, shown with `<Example>`. */
export interface ExampleFile {
  name: string;
  file: string;
}

/** The sample whose files the page shows for a pack, when it is not the first sample that reads the connector with that pack alone. */
const catalogues: Record<string, string> = { adf: "adf-native-connectors" };

/** The worked example of table watermarks that every `adf-copy` page shows. */
export const watermarkExample = "private-sql-server";

const definitions = new Map<string, { file: string; data: Record<string, unknown> }[]>();
/** A sample's connection and flow files, read once. */
function definitionsOf(name: string) {
  let found = definitions.get(name);
  if (!found) {
    found = exampleFiles(name)
      .filter((file) => /^(connections|flows)\/.*\.ya?ml$/.test(file))
      .map((file) => ({
        file,
        data: parse(readExampleFile(name, file)) as Record<string, unknown>,
      }));
    definitions.set(name, found);
  }
  return found;
}

/**
 * The connection and flow files a page shows for one pack: from the pack's
 * catalogue, or from the first sample that uses only that pack and reads the
 * connector. The connection is the one whose `connector` is the id, and the
 * flow the one whose `source` is that connection.
 */
export function connectorExample(
  id: string,
  pack: string,
): { connection: ExampleFile; flow: ExampleFile } {
  const name =
    catalogues[pack] ??
    listExamples().find(
      (example) =>
        example.facts.packs.length === 1 &&
        example.facts.packs[0] === pack &&
        example.facts.connectors.includes(id),
    )?.name;
  if (!name) throw new Error(`No sample reads "${id}" with the ${pack} pack alone.`);
  const files = definitionsOf(name);
  const connection = files.find(
    ({ file, data }) => file.startsWith("connections/") && data.connector === id,
  );
  if (!connection) throw new Error(`The sample "${name}" has no ${id} connection.`);
  const flow = files.find(
    ({ file, data }) => file.startsWith("flows/") && data.source === connection.data.id,
  );
  if (!flow)
    throw new Error(`The sample "${name}" has no flow from "${String(connection.data.id)}".`);
  return { connection: { name, file: connection.file }, flow: { name, file: flow.file } };
}

/** The routes a connector's entry starts, once each, with their guides. */
function routesOf(id: string, entry: ConnectorEntry) {
  return projectRoutes(id)
    .filter((route) => route.method === entry.connector.method)
    .filter((route, index, all) => all.findIndex((other) => other.via === route.via) === index)
    .map(({ via, title }) => {
      const guide = routeGuides[via];
      if (!guide) throw new Error(`No guide for the route "${via}".`);
      return { via, title, guide: `/docs/${guide}` };
    });
}

/** Lines for the routes the connector has, from words written per route. */
function byRoute(id: string, entry: ConnectorEntry, words: Record<string, string>) {
  return routesOf(id, entry).flatMap((route) =>
    words[route.via] === undefined ? [] : [{ ...route, text: words[route.via]! }],
  );
}

const windows = "[time window](/docs/platforms/adf#define-the-time-windows)";

/** How the source is reached, before the connection is written. */
function access({ pack, connector }: ConnectorEntry): string[] {
  const vendor = `[${connector.title} in the ${packName(pack)} documentation](${connector.docs})`;
  if (pack === "adf")
    return [
      `Prepare [source access, the runtime and credentials](/docs/platforms/adf#platform-prerequisites), then check the vendor's prerequisites for permissions, drivers, versions and authentication in ${vendor}.`,
      "Name the runtime, Key Vault and landing storage in the platform's method settings; see [Runtime and Key Vault](/docs/platforms/adf#runtime-and-key-vault).",
    ];
  if (connector.method === "lakeflow-connect")
    return [
      "An administrator creates a Unity Catalog connection to the source. Name it in the connection's `uc_connection`; no credentials go in the definitions.",
      `Read ${vendor} for what the source needs.`,
    ];
  if (connector.method === "files")
    return [
      "Put the files in a folder the workspace can read: a Unity Catalog volume, such as `/Volumes/dev/landing/shop`, or a cloud storage URL. Name it in the connection's `path`; each table reads a sub-folder named by its `object`.",
      `Read ${vendor} for the formats and options it reads.`,
    ];
  throw new Error(`No access words for the ${pack} method ${connector.method}.`);
}

/** What the reader replaces in the example connection, by method: ADF's hold an endpoint and an account. */
const replace: Record<string, string> = {
  "lakeflow-connect": "replace the Unity Catalog connection's name in `uc_connection` with yours",
  files: "replace the folder in `path` with yours",
};

function exampleWords({ pack, connector }: ConnectorEntry): string[] {
  const what =
    replace[connector.method] ??
    (pack === "adf" ? "replace the endpoint and account details with yours" : undefined);
  if (!what) throw new Error(`No example words for the ${pack} method ${connector.method}.`);
  return [
    `The example uses synthetic values: ${what}. \`id\` is the name a flow uses in \`source\`, and \`connector\` selects the source type.` +
      (connector.settings.some((setting) => setting.secret)
        ? " A secret reference such as `${secret:source-password}` names a secret; it never contains the password itself."
        : ""),
  ];
}

function reading(id: string, entry: ConnectorEntry): Part {
  const { pack, connector } = entry;
  const part = {
    kind: "reading" as const,
    id: `${pack}-reading`,
    slot: `${pack}-reading`,
    after: [],
  };
  switch (connector.method) {
    case "adf-table":
      return {
        ...part,
        title: "How it reads",
        before: [
          `Each ${windows} copies the selection again. This connector keeps no incremental watermark, so what happens to repeated rows depends on the destination; see [Keep the destination current](#${pack}-current).`,
        ],
      };
    case "adf-copy":
      return {
        ...part,
        title: "Full copies and incremental windows",
        before: [
          `\`mode: full\` copies the whole table each ${windows}. \`mode: incremental\` copies rows whose \`watermark_column\` falls within that window. Choose a column that records when a row changes, such as \`modified_at\`; an integer identity is not a time-window watermark.`,
        ],
        after: [
          "The watermark is configured in the flow's `ingest.with`, or as a default in the standard's `ingest.settings.adf-copy`. It is not a contract property. Each table can override the default with its own `mode` and `watermark_column`; the contract describes the columns and keys of that table.",
          "The filter is always the trigger window's inclusive start and exclusive end. Ingestron does not track the greatest value seen in an earlier run. A change outside the selected window is not copied by that window. Arbitrary SQL queries, extra `WHERE` criteria and per-table window schedules are not supported by `adf-copy`.",
          "Use the source column name for `watermark_column`. A contract's `physicalName` can rename a selected column, but it does not rewrite the watermark filter.",
          "All tables of one connection and source database share runtime, encryption, schedule, retry and paused settings. Those values must agree even when the tables use different watermarks.",
        ],
      };
    case "adf-files":
      return {
        ...part,
        title: "File selection and format",
        before: [
          `With \`mode: new\`, each ${windows} copies the files that changed in it; \`mode: all\` copies every matching file in every window. \`files\` picks which files in the folder and its sub-folders to copy. All tables of one connection use one linked service, pipeline and trigger, so they share runtime and schedule settings.`,
          "ADF copies the files as they are, keeping their names and folders. Set `format` to the files' format.",
        ],
        routes: byRoute(id, entry, {
          "adf-databricks":
            "Databricks reads the landed files in that format. `options` configures its reader, for example CSV headers, and with `schema_hints` on, the contract's column types are passed to it.",
          "adf-landing": "Nothing reads the files: the landed files are the result.",
        }),
      };
    case "lakeflow-connect":
      return {
        ...part,
        title: "How it reads",
        before: [
          "Lakeflow Connect writes each table itself, with the source's column names. A contract's `physicalName` cannot rename a column, and a flow cannot add checks to the table: rename columns and check the data in a transform that reads the table.",
        ],
      };
    case "files":
      return {
        ...part,
        title: "How it reads",
        before: [
          "Databricks reads the files where they are with Auto Loader, into a [streaming table](/docs/reference/packs/databricks#streaming-table) that reads each file once. To keep only the current row per key from change records, see [Keep a table current](/docs/how-to/keep-a-table-current#on-databricks).",
        ],
      };
  }
  throw new Error(`No reading words for the ${pack} method ${connector.method}.`);
}

/** What the destination keeps from repeated copies, for the ADF methods. */
function current(id: string, entry: ConnectorEntry): Part | undefined {
  const { pack, connector } = entry;
  const lead: Record<string, string> = {
    "adf-table": "A row missing from a later copy does not mean it was deleted.",
    "adf-copy":
      "ADF writes Parquet into landing storage. Repeated full copies land the same rows again, and a row missing from a later copy does not tell the destination to delete it.",
    "adf-files":
      "A file copied again can replace the landed file. Prefer sources that write new files rather than rewriting old ones.",
  };
  if (pack !== "adf") return undefined;
  if (!lead[connector.method])
    throw new Error(`No words on keeping tables current for ${connector.method}.`);
  const databricks =
    connector.method === "adf-files"
      ? "Auto Loader reads each file once by default. Choose how the table keeps the rows inside those files, separately from which files ADF copies; see [On Databricks](/docs/how-to/keep-a-table-current#on-databricks)."
      : "Databricks reads the landed files into a streaming table. With `mode: append`, repeated copies add repeated rows; `upsert` keeps the current row per key and `history` keeps every version, ordered by a column you choose. See [On Databricks](/docs/how-to/keep-a-table-current#on-databricks)." +
        (connector.method === "adf-copy"
          ? " The store's `sequence_by` decides which version wins; it is separate from the extraction watermark. ADF and Databricks run on separate schedules."
          : "");
  return {
    kind: "current",
    id: `${pack}-current`,
    title: "Keep the destination current",
    before: [lead[connector.method]!],
    routes: byRoute(id, entry, {
      "adf-databricks": databricks,
      "adf-synapse":
        "A view reads the landed files each time it is queried and shows them as they are: it cannot keep a current row per key. See [On Synapse](/docs/how-to/keep-a-table-current#on-synapse).",
      "adf-duckdb":
        "The DuckDB table's `mode` decides what it keeps; see [On DuckDB](/docs/how-to/keep-a-table-current#on-duckdb).",
      "adf-landing": "The landed files are the result: nothing merges them.",
    }),
    after: [],
  };
}

function connectSection(entry: ConnectorEntry): Section {
  const { pack, connector } = entry;
  const part = (kind: PartKind, id: string, title: string, before: string[] = []): Part => ({
    kind,
    id: `${pack}-${id}`,
    title,
    before,
    after: [],
  });
  const items: Item[] = [
    {
      part: {
        ...part("access", "access", "Prepare access", access(entry)),
        slot: `${pack}-access`,
      },
    },
    { part: part("example", "example", "Example connection", exampleWords(entry)) },
  ];
  if (connector.method === "adf-copy")
    items.push({
      part: part("encryption", "encryption", "Encryption and certificates", [
        "Set `encrypt` in the `adf-copy` method settings, not in the connection's `settings`. When the server's certificate names a different host from the endpoint you use, set the connection's `host_name_in_certificate` to the name in the certificate. Certificate validation stays on: this does not make an untrusted certificate trusted.",
      ]),
    });
  items.push(
    { slot: `${pack}-connection` },
    { part: part("fields", "fields", "Connection fields") },
  );
  return {
    id: `${pack}-connection`,
    title: `Connect with ${packName(pack)}`,
    entry,
    before: [],
    items,
  };
}

function readSection(id: string, entry: ConnectorEntry): Section {
  const { pack, connector } = entry;
  const items: Item[] = [
    {
      part: {
        kind: "tables",
        id: `${pack}-tables`,
        title: "Choose the tables",
        before: [
          "The connection's `id` is the flow's `source`. Each entry under `tables` names a destination table and links its source `object` to a contract. The contract lists the columns and keys you expect. Replace the synthetic object and contract with yours before deploying.",
        ],
        after: [],
      },
    },
    { part: reading(id, entry) },
  ];
  if (connector.method === "adf-copy")
    items.push({
      part: {
        kind: "watermarks",
        id: `${pack}-watermarks`,
        title: "Different watermarks per table",
        before: [
          "In this example, the standard reads changed rows once an hour using `modified_at`. Customers inherit that default. Invoices override the watermark with `updated_at` in the flow and set the store's ordering column to match. The same hourly trigger serves both tables.",
          ...watermarkNote(id),
        ],
        after: [],
      },
    });
  items.push({ slot: `${pack}-ingestion` });
  items.push({
    part: {
      kind: "settings",
      id: `${pack}-settings`,
      title: "Reading settings",
      before: [],
      after: [],
    },
  });
  const keep = current(id, entry);
  if (keep) items.push({ part: keep });
  return {
    id: `${pack}-ingestion`,
    title: `Read with ${packName(pack)}`,
    entry,
    before: [],
    items,
  };
}

/** When the watermark example reads another connector, say so. */
function watermarkNote(id: string): string[] {
  const example = listExamples().find((item) => item.name === watermarkExample);
  if (!example) throw new Error(`No sample "${watermarkExample}".`);
  const other = example.facts.connectors.find((connector) => connector !== id);
  if (!other || example.facts.connectors.includes(id)) return [];
  const title = connectorEntries(other)[0]?.connector.title ?? other;
  return [
    `The example's connection is ${title}; its settings work the same for this source. Keep your own connection and source objects.`,
  ];
}

/** The connector's page, section by section, in reading order. */
export function connectorSections(id: string): Section[] {
  const entries = connectorEntries(id);
  if (entries.length === 0) throw new Error(`No pack reads connector "${id}".`);
  const title = entries[0]!.connector.title;
  return [
    {
      id: "routes",
      title: "Routes",
      before: [
        `These are the routes a project can take for ${title}, by the pack that reads the source. To compare them, see [Choose where your data goes](/docs/start/choose-a-route). To create a project from this connection, see [Start from a connection](/docs/how-to/start-from-a-template#start-from-a-connection).`,
      ],
      items: [],
    },
    ...entries.flatMap((entry) => [connectSection(entry), readSection(id, entry)]),
    {
      id: "examples",
      title: "Examples",
      before: [
        "These projects use synthetic values. Choose a download for your route, then [adapt and generate it](/docs/how-to/start-from-a-template#make-it-yours). Multi-connector projects contain other sources too; to start with only this connection, use [Create a project](/docs/how-to/start-from-a-template#start-from-a-connection).",
      ],
      items: [{ slot: "examples" }],
    },
  ];
}

/** Every slot a note can go in on the connector's page. */
export function connectorSlots(id: string): string[] {
  return connectorSections(id).flatMap((section) =>
    section.items.flatMap((item) =>
      "slot" in item ? [item.slot] : item.part.slot ? [item.part.slot] : [],
    ),
  );
}

/** The anchor under which the editor lists a connector's settings: the first pack's connection fields. */
export const settingsAnchor = "settings";

/**
 * For each heading in a connector's MDX file, the slot of the note it is in.
 * Headings are found outside code blocks, in the order MDX numbers them.
 */
export function noteHeadingSlots(id: string): string[] {
  const text = readFileSync(join(process.cwd(), "content/docs/connectors", `${id}.mdx`), "utf8");
  const slots: string[] = [];
  let slot: string | undefined;
  let fenced = false;
  for (const line of text.split("\n")) {
    if (line.trimStart().startsWith("```")) fenced = !fenced;
    if (fenced) continue;
    const opened = /<ConnectorNote at="([^"]+)">/.exec(line);
    if (opened) slot = opened[1];
    if (line.startsWith("</ConnectorNote>")) slot = undefined;
    if (/^#{1,6} /.test(line)) {
      if (!slot) throw new Error(`connectors/${id}.mdx: a heading outside a ConnectorNote.`);
      slots.push(slot);
    }
  }
  return slots;
}

/**
 * The page's table of contents: each section and part, with the notes'
 * headings where their slots are. `notes` is the MDX file's own table of
 * contents, which holds only the notes' headings.
 */
export function connectorToc(id: string, notes: TOCItemType[]): TOCItemType[] {
  const slots = noteHeadingSlots(id);
  if (slots.length !== notes.length)
    throw new Error(`connectors/${id}.mdx: ${notes.length} headings, ${slots.length} in notes.`);
  const known = connectorSlots(id);
  const unknown = slots.filter((slot) => !known.includes(slot));
  if (unknown.length > 0)
    throw new Error(`connectors/${id}.mdx: no slot ${unknown.join(", ")} on this page.`);
  const inSlot = (slot: string) => notes.filter((_, index) => slots[index] === slot);
  return connectorSections(id).flatMap((section) => [
    { title: section.title, url: `#${section.id}`, depth: 2 },
    ...section.items.flatMap((item) =>
      "slot" in item
        ? inSlot(item.slot)
        : [
            { title: item.part.title, url: `#${item.part.id}`, depth: 3 },
            ...inSlot(item.part.slot ?? ""),
          ],
    ),
  ]);
}

/** A category's anchor on the catalogue: `Files and storage` is `files-and-storage`. */
export function categoryAnchor(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The catalogue's categories, in the order New project lists its sources. */
export function sourceCategories(): string[] {
  return [...new Set(projectSources().map((source) => source.category))];
}

/** The catalogue's table of contents: its own headings, then a heading per category. */
export function catalogueToc(own: TOCItemType[]): TOCItemType[] {
  return [
    ...own,
    ...sourceCategories().map((name) => ({
      title: name,
      url: `#${categoryAnchor(name)}`,
      depth: 2,
    })),
  ];
}
