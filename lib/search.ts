// Search entries for reference rendered from code, which the MDX indexer
// cannot see: error codes, method settings, CLI commands and connector pages.
import { commands, flags, projectSources } from "@ingestron/cli";
import { codeHelp } from "@ingestron/definitions";
import type { StructuredData } from "fumadocs-core/mdx-plugins";
import { ingestionRows } from "./connector-settings";
import { categoryAnchor, connectorSections, sourceCategories } from "./connector-page";
import { anchorId, connectorEntries, fieldPath, packPages, packs, settingRows } from "./reference";

/** Headings and paragraphs to add to a page's search entries, by page URL. */
export function extraStructure(url: string): StructuredData {
  if (url === "/docs/reference/errors") return errorCodes();
  const page = packPages().find((candidate) => candidate.url === url);
  if (page) return methods(page.pack);
  if (url === "/docs/connectors" || url.startsWith("/docs/connectors/"))
    return connectorStructure(url);
  if (url === "/docs/reference/cli") return cli();
  return { headings: [], contents: [] };
}

function errorCodes(): StructuredData {
  const entries = Object.entries(codeHelp);
  return {
    headings: entries.map(([code]) => ({ id: code, content: code })),
    contents: entries.map(([code, help]) => ({
      heading: code,
      content: `${code}: ${help.meaning} Fix: ${help.fix}`,
    })),
  };
}

function methods(pack: string): StructuredData {
  const found = packs.find((candidate) => candidate.id === pack);
  const all = Object.entries(found?.methods ?? {}).map(([id, method]) => ({ pack, id, method }));
  return {
    headings: all.map(({ id }) => ({ id, content: id })),
    contents: all.flatMap(({ pack, id, method }) => [
      { heading: id, content: method.description },
      ...settingRows(pack, id).map((field) => ({
        heading: id,
        content:
          `${field.path.join(".")}: ${field.description ?? ""} ${(field.values ?? []).map((item) => item.value).join(", ")}`.trim(),
      })),
    ]),
  };
}

function cli(): StructuredData {
  return {
    headings: [],
    contents: [
      ...commands.map(({ name, summary }) => ({
        heading: undefined,
        content: `ingestron ${name}: ${summary}`,
      })),
      ...flags.map(({ flag, summary }) => ({ heading: undefined, content: `${flag}: ${summary}` })),
    ],
  };
}

/** A connector's page, as its component renders it: sections, parts, fields and settings. */
function connectorStructure(url: string): StructuredData {
  const [, , , id] = url.split("/");
  if (!id) return catalogue();
  if (connectorEntries(id).length === 0) return { headings: [], contents: [] };
  const headings: StructuredData["headings"] = [];
  const contents: StructuredData["contents"] = [];
  for (const section of connectorSections(id)) {
    headings.push({ id: section.id, content: section.title });
    contents.push(...section.before.map((text) => ({ heading: section.id, content: plain(text) })));
    if (section.id === "routes")
      contents.push(
        ...connectorEntries(id).map(({ pack, connector }) => ({
          heading: section.id,
          content: `${pack} ${connector.method}: ${connector.generates}. Object: ${connector.object}.`,
        })),
      );
    for (const item of section.items) {
      if ("slot" in item) continue;
      const { part } = item;
      headings.push({ id: part.id, content: part.title });
      contents.push(
        ...[
          ...part.before,
          ...(part.routes ?? []).map((route) => `${route.title}: ${route.text}`),
          ...part.after,
        ].map((text) => ({ heading: part.id, content: plain(text) })),
      );
      if (part.kind === "fields") connectionFields(id, section.entry!.pack, headings, contents);
      if (part.kind === "settings") ingestionFields(id, section.entry!.pack, headings, contents);
    }
  }
  return { headings, contents };
}

/** Text as a reader sees it: no backticks, and a link's words without its address. */
function plain(text: string): string {
  return text.replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function connectionFields(
  id: string,
  pack: string,
  headings: StructuredData["headings"],
  contents: StructuredData["contents"],
): void {
  const connector = connectorEntries(id).find((entry) => entry.pack === pack)!.connector;
  for (const field of connector.settings) {
    const anchor = `${pack}-connection-${field.name}`;
    headings.push({ id: anchor, content: field.name });
    contents.push({
      heading: anchor,
      content:
        `${connector.title} ${field.name}: ${field.description} ${(field.values ?? []).join(", ")}`.trim(),
    });
  }
}

function ingestionFields(
  id: string,
  pack: string,
  headings: StructuredData["headings"],
  contents: StructuredData["contents"],
): void {
  const reading = connectorEntries(id).find((entry) => entry.pack === pack)?.connector.reading;
  for (const field of ingestionRows(id, pack)) {
    headings.push({ id: anchorId(field), content: fieldPath(field) });
    contents.push({
      heading: anchorId(field),
      content:
        `${fieldPath(field)}: ${field.description ?? ""} ${(field.values ?? []).map((value) => value.value).join(", ")}`.trim(),
    });
  }
  if (reading)
    contents.push({
      heading: `${pack}-settings`,
      content:
        `query: ${reading.query}. Landing format: ${reading.format}. ${reading.runtime ? `Required runtime_kind: ${reading.runtime}.` : ""}`.trim(),
    });
}

/** The catalogue: a heading per category, and each source in it. */
function catalogue(): StructuredData {
  const categories = sourceCategories();
  return {
    headings: categories.map((name) => ({ id: categoryAnchor(name), content: name })),
    contents: projectSources().map((source) => ({
      heading: categoryAnchor(source.category),
      content: source.title,
    })),
  };
}

/** Name a connector's page as a connector in search results, where "Files" alone could be any page.
 * @example searchTitle("/docs/connectors/files", "Files") // "Files connector"
 */
export function searchTitle(url: string, title: string): string {
  const [, , area, id, rest] = url.split("/");
  if (area !== "connectors" || !id || rest !== undefined) return title;
  return connectorEntries(id).length > 0 ? `${title} connector` : title;
}
