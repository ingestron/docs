// Search entries for reference rendered from code, which the MDX indexer
// cannot see: error codes, method settings, CLI commands and connector pages.
import { commands, flags } from "@ingestron/cli";
import { projectRoutes, projectSources } from "@ingestron/core";
import { codeHelp } from "@ingestron/definitions";
import type { StructuredData } from "fumadocs-core/mdx-plugins";
import { ingestionRows } from "./connector-settings";
import { catalogueToc, categoryAnchor, connectorSections } from "./connector-page";
import { platformById, type Platform, platformIds } from "./platforms";
import {
  anchorId,
  connectorEntries,
  fieldPath,
  intentRows,
  packPages,
  packs,
  platformSectionFields,
  settingRows,
} from "./reference";

/** Headings and paragraphs to add to a page's search entries, by page URL. */
export function extraStructure(url: string): StructuredData {
  if (url === "/docs/reference/errors") return errorCodes();
  const page = packPages().find((candidate) => candidate.url === url);
  if (page) return methods(page.pack);
  const connector = connectorUrl.exec(url);
  if (connector) return connectorStructure(connector[1] as Platform["id"], connector[2]);
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

/** A pack's page: its methods and settings, its section of the Platform, and its intent. */
function methods(pack: string): StructuredData {
  const found = packs.find((candidate) => candidate.id === pack);
  const all = Object.entries(found?.methods ?? {}).map(([id, method]) => ({ pack, id, method }));
  const section = platformSectionFields(pack);
  return {
    headings: [
      ...all.map(({ id }) => ({ id, content: id })),
      ...section.map((field) => ({ id: anchorId(field), content: fieldPath(field) })),
    ],
    contents: [
      ...all.flatMap(({ pack, id, method }) => [
        { heading: id, content: method.description },
        ...settingRows(pack, id).map((field) => ({
          heading: id,
          content:
            `${field.path.join(".")}: ${field.description ?? ""} ${(field.values ?? []).map((item) => item.value).join(", ")}`.trim(),
        })),
      ]),
      ...section.map((field) => ({
        heading: anchorId(field),
        content: `${fieldPath(field)}: ${field.description ?? ""} ${field.find ?? ""}`.trim(),
      })),
      ...intentRows(pack).map(({ path, values, use }) => ({
        heading: "intent",
        content: `${path} ${values.join(", ")}: ${use.use === "used" ? use.does : use.reason}`,
      })),
    ],
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

/** A platform's connector page, or its catalogue: /docs/<platform>/connectors[/<id>]. */
const connectorUrl = new RegExp(`^/docs/(${platformIds.join("|")})/connectors(?:/([^/]+))?$`);

/** A platform's connector page, as its component renders it: sections, parts, fields and settings. */
function connectorStructure(on: Platform["id"], id: string | undefined): StructuredData {
  if (!id) return catalogue(on);
  if (connectorEntries(id).length === 0) return { headings: [], contents: [] };
  const headings: StructuredData["headings"] = [];
  const contents: StructuredData["contents"] = [];
  const sections = connectorSections(id, on);
  const shown = new Set(sections.flatMap((section) => (section.entry ? [section.entry.pack] : [])));
  for (const section of sections) {
    headings.push({ id: section.id, content: section.title });
    contents.push(...section.before.map((text) => ({ heading: section.id, content: plain(text) })));
    if (section.id === "routes")
      contents.push(
        ...connectorEntries(id)
          .filter(({ pack }) => shown.has(pack))
          .map(({ pack, connector }) => ({
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

/** A platform's catalogue: a heading per category it has, and each source it loads. */
function catalogue(on: Platform["id"]): StructuredData {
  const routes = platformById(on).routes;
  const categories = catalogueToc([], on).map((item) => String(item.title));
  return {
    headings: categories.map((name) => ({ id: categoryAnchor(name), content: name })),
    contents: projectSources()
      .filter((source) => projectRoutes(source.id).some((route) => routes.includes(route.via)))
      .map((source) => ({
        heading: categoryAnchor(source.category),
        content: source.title,
      })),
  };
}

/** Name a connector's page as a connector in search results, where "Files" alone could be any page.
 * @example searchTitle("/docs/databricks/connectors/files", "Files") // "Files connector"
 */
export function searchTitle(url: string, title: string): string {
  const id = connectorUrl.exec(url)?.[2];
  if (!id) return title;
  return connectorEntries(id).length > 0 ? `${title} connector` : title;
}
