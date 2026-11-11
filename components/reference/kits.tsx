// Published standards (kits), from the installed @ingestron/standards
// package: the list to choose from, one kit's facts, a file of it with each
// REPLACE_ME explained, and how each of its tables resolves.
import type { ReactNode } from "react";
import { ServerCodeBlock, type ServerCodeBlockProps } from "fumadocs-ui/components/codeblock.rsc";
import { KindBlock } from "@/components/code-block";
import { ReplaceMe, TipText } from "@/components/replace-me";
import { TableFrame } from "@/components/table-frame";
import { codeThemes } from "@/lib/code-themes";
import { pickPath } from "@/lib/extract";
import {
  kitBlanks,
  kitById,
  kitFile,
  kitIntent,
  kitPage,
  latestKits,
  type Blank,
} from "@/lib/kits";
import { packName } from "@/lib/reference";
import { Inline } from "./inline";

const levels = { ga: "Generally available features only", preview: "Uses preview features" };

/** The pack ids of a kit's `packs`, such as `databricks` for `databricks@2`. */
const packIds = (packs: string[]) => packs.map((pack) => pack.split("@")[0]!);

/**
 * Every published standard installed with Ingestron, newest version of each,
 * linked to its page.
 * @example <KitList />
 */
export function KitList() {
  return (
    <TableFrame label="Published standards">
      <table>
        <thead>
          <tr>
            <th>Standard</th>
            <th>Platform</th>
            <th>What it builds</th>
            <th>Start with</th>
          </tr>
        </thead>
        <tbody>
          {latestKits().map((kit) => (
            <tr key={kit.id}>
              <td>
                <a href={kitPage(kit.id)}>{kit.title}</a>
              </td>
              <td>{packIds(kit.packs).map(packName).join(", ")}</td>
              <td>{kit.summary}</td>
              <td>
                <code>
                  --kit {kit.id}@{kit.version}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

/**
 * One kit's facts, from its kit.yaml: what it builds, its version, packs,
 * release level and the Ingestron it needs.
 * @example <KitFacts id="duckdb/local-medallion" />
 */
export function KitFacts({ id }: { id: string }) {
  const kit = kitById(id);
  return (
    <dl className="connector-summary">
      <dt>Builds</dt>
      <dd>{kit.summary}</dd>
      <dt>Name</dt>
      <dd>
        <code>{kit.id}</code>
      </dd>
      <dt>Version</dt>
      <dd>
        <code>{kit.version}</code>
        {kit.notes && (
          <>
            : <Inline text={kit.notes.trim()} />
          </>
        )}
      </dd>
      <dt>Packs</dt>
      <dd>
        {kit.packs.map((pack, index) => (
          <span key={pack}>
            {index > 0 && ", "}
            <a href={`/docs/reference/packs/${pack.split("@")[0]}`}>
              <code>{pack}</code>
            </a>
          </span>
        ))}
      </dd>
      <dt>Features</dt>
      <dd>
        {levels[kit.features]} (<code>features: {kit.features}</code>)
      </dd>
      <dt>Needs</dt>
      <dd>
        <code>ingestron {kit.requires.ingestron}</code>
      </dd>
    </dl>
  );
}

/** The note id of a kit file's blank, unique on the page. */
const noteId = (id: string, file: string, index: number) =>
  `${id}-${file}-${index + 1}`.replace(/[^a-z0-9-]+/gi, "-");

type Transformer = NonNullable<ServerCodeBlockProps["transformers"]>[number];
type Content = Parameters<NonNullable<Transformer["span"]>>[0]["children"][number];

/** Marks each REPLACE_ME token as a `replace-me` element that names its blank. */
function markBlanks(blanks: Blank[]): Transformer {
  return {
    name: "replace-me",
    span(node, _line, _column, _lineElement, token) {
      const index = blanks.findIndex(
        (blank) =>
          blank.offset >= token.offset && blank.offset < token.offset + token.content.length,
      );
      if (index < 0) return;
      const at = blanks[index]!.offset - token.offset;
      const parts: Content[] = [
        { type: "text", value: token.content.slice(0, at) },
        {
          type: "element",
          tagName: "replace-me",
          properties: { dataBlank: String(index) },
          children: [{ type: "text", value: "REPLACE_ME" }],
        },
        { type: "text", value: token.content.slice(at + "REPLACE_ME".length) },
      ];
      node.children = parts.filter((part) => part.type !== "text" || part.value !== "");
    },
  };
}

/**
 * A file of a kit as the kit has it. Each value still `REPLACE_ME` is marked,
 * focusable, with a tooltip giving the field, where to find the value and a
 * suggestion, from the same field reference as the editor's hover; the notes
 * below the block say the same, and show on touch screens.
 * With `pick`, a YAML path, only that part of a file that has no
 * `REPLACE_ME`, as it is in the file.
 * @example <KitFile id="databricks/lakehouse-streaming" file="platform.yaml" />
 * @example <KitFile id="duckdb/local-medallion" file="standard.yaml" pick="layers" />
 */
export function KitFile({ id, file, pick }: { id: string; file: string; pick?: string }) {
  const kit = kitById(id);
  const blanks = file.endsWith(".yaml") ? kitBlanks(kit, file) : [];
  const unexplained = blanks.filter((blank) => !blank.help);
  if (unexplained.length > 0)
    throw new Error(
      `${kit.id}@${kit.version} ${file}: no field explains the REPLACE_ME at ${unexplained.map((blank) => blank.pointer).join(", ")}.`,
    );
  if (pick !== undefined && blanks.length > 0)
    throw new Error(`${kit.id}@${kit.version} ${file}: pick only a file with no REPLACE_ME.`);
  const picked = pick === undefined ? kitFile(kit, file) : pickPath(kitFile(kit, file), pick);
  if (picked === undefined) throw new Error(`${kit.id}@${kit.version} ${file} has no "${pick}".`);
  const title = pick === undefined ? file : `${file} › ${pick}`;
  const extension = file.split(".").pop() ?? "text";
  return (
    <>
      <ServerCodeBlock
        code={picked.trimEnd()}
        lang={extension === "yml" ? "yaml" : extension}
        themes={codeThemes}
        transformers={[markBlanks(blanks)]}
        components={{
          pre: ({ children, ...props }) => (
            <KindBlock
              {...props}
              kind="write"
              title={title}
              className="my-4"
              viewportProps={{ "aria-label": `${kit.id}@${kit.version}/${file}` }}
            >
              {children}
            </KindBlock>
          ),
          // Not an HTML element: the mark markBlanks writes in place of each REPLACE_ME token.
          ...({
            "replace-me": ({
              "data-blank": blank,
              children,
            }: {
              "data-blank": string;
              children?: ReactNode;
            }) => {
              const index = Number(blank);
              const help = blanks[index]!.help!;
              return (
                <ReplaceMe
                  note={noteId(kit.id, file, index)}
                  number={index + 1}
                  tip={{
                    field: help.field,
                    ...(help.description && { description: help.description }),
                    ...(help.find && { find: help.find }),
                    ...(help.suggest && { suggest: help.suggest }),
                  }}
                >
                  {children}
                </ReplaceMe>
              );
            },
          } as ServerCodeBlockProps["components"]),
        }}
      />
      {blanks.length > 0 && (
        <ol className="replace-me-notes" aria-label={`Values to replace in ${file}`}>
          {blanks.map((blank, index) => (
            <li key={blank.pointer} id={noteId(kit.id, file, index)} value={index + 1}>
              <span className="replace-me-where">Line {blank.line}:</span>{" "}
              <TipText tip={blank.help!} />{" "}
              <a href={blank.help!.docs} className="replace-me-line">
                Reference for <code>{blank.help!.field}</code>
              </a>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** Where an intent value came from, in the words the editor's hover uses. */
function from(
  origin: { layer: string; file?: string; line?: number; alias?: string },
  kind: string,
) {
  const layer = {
    pack: "the pack's default",
    standard: "the standard",
    platform: "the platform",
    layer: "the table's layer in the standard",
    rule: "a standard rule",
    definition: kind === "Flow" ? "the flow" : "the transform",
    table: "this table",
    fixed: "the standard, fixed",
  }[origin.layer];
  const where = origin.file ? ` (${origin.file}:${origin.line})` : "";
  return origin.alias ? `the setting "${origin.alias}" in ${layer}${where}` : `${layer}${where}`;
}

/**
 * Each of the kit's tables, its intent and where each value came from, as
 * `plan` resolves the kit and the editor's hover shows it.
 * @example <KitIntent id="duckdb/local-medallion" />
 */
export function KitIntent({ id }: { id: string }) {
  const kit = kitById(id);
  return (
    <TableFrame label={`How each table of ${kit.id} resolves`}>
      <table>
        <thead>
          <tr>
            <th>Table</th>
            <th>Intent</th>
            <th>From</th>
          </tr>
        </thead>
        <tbody>
          {kitIntent(kit).map((row) => (
            <tr key={`${row.table} ${row.path}`}>
              <td>
                <code>
                  {row.layer}.{row.table}
                </code>
              </td>
              <td>
                <code>
                  {row.path}: {row.value}
                </code>
              </td>
              <td>{from(row.origin, row.kind)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}
