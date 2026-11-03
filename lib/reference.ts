// Reference data read from the packages at build time, so pages match the code.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRecipe, projectRoutes, projectSources, type ProjectRoute } from "@ingestron/cli";
import {
  documentReference,
  methodReference,
  referenceKinds,
  type Connector,
  type FieldInfo,
  type Pack,
} from "@ingestron/definitions";
import { adf } from "@ingestron/pack-adf";
import { databricks } from "@ingestron/pack-databricks";
import { duckdb } from "@ingestron/pack-duckdb";
import { synapse } from "@ingestron/pack-synapse";
import { parse } from "yaml";

/** The packs the CLI provides, in the order a standard usually lists them. */
export const packs: Pack[] = [databricks, adf, synapse, duckdb];

/** Each pack's reference page. */
export function packPages(): { pack: string; url: string }[] {
  return packs.map((pack) => ({ pack: pack.id, url: `/docs/reference/packs/${pack.id}` }));
}

/** A page's title, from its front matter, by its path under `/docs/`. */
export function pageTitle(path: string): string {
  const text = readFileSync(join(process.cwd(), "content/docs", `${path}.mdx`), "utf8");
  const title = (parse(text.split("---")[1] ?? "") as { title?: string } | null)?.title;
  if (!title) throw new Error(`The page "${path}" has no title.`);
  return title;
}

/** A pack's name, from the title of its reference page: "Azure Data Factory" for `adf`. */
export function packName(pack: string): string {
  return pageTitle(`reference/packs/${pack}`).replace(/ pack$/, "");
}

/** Every route New project offers for some source, once each, in the order it lists them. */
export function allRoutes(): Pick<ProjectRoute, "via" | "title">[] {
  const order: Pick<ProjectRoute, "via" | "title">[] = [];
  for (const source of projectSources()) {
    let next = 0;
    for (const { via, title } of projectRoutes(source.id)) {
      const known = order.findIndex((route) => route.via === via);
      if (known === -1) order.splice(next++, 0, { via, title });
      else next = known + 1;
    }
  }
  return order;
}

const routePackCache = new Map<string, string[]>();

/** The packs a route's project lists in its standard, as New project writes it: `["synapse", "adf"]`. */
export function routePacks(via: string): string[] {
  let found = routePackCache.get(via);
  if (!found) {
    const source = projectSources().find((item) =>
      projectRoutes(item.id).some((route) => route.via === via),
    );
    const route = source && projectRoutes(source.id).find((item) => item.via === via);
    if (!source || !route) throw new Error(`No source has the route "${via}".`);
    const { files } = projectRecipe(source.id, via, route.connectivity[0] ?? "public");
    const standard = parse(String(files["standard.yaml"])) as { packs: string[] };
    found = standard.packs.map((pack) => pack.split("@")[0]!);
    routePackCache.set(via, found);
  }
  return found;
}

/** A method's settings, described once for the docs and the editor. */
export function settingRows(pack: string, method: string): FieldInfo[] {
  const found = packs.find((candidate) => candidate.id === pack);
  if (!found?.methods[method]) throw new Error(`No method "${method}" in pack "${pack}".`);
  return methodReference(found, method);
}

/** A connector as one pack describes it. */
export interface ConnectorEntry {
  pack: string;
  connector: Connector;
  /** The connectivity the connector's method supports; empty means any. */
  connectivity: string[];
}

/** Every connector any pack reads, once each, sorted. */
export function connectorIds(): string[] {
  const ids = packs.flatMap((pack) => pack.connectors?.map((item) => item.id) ?? []);
  return [...new Set(ids)].sort();
}

/** How each pack reads one connector, in pack order. */
export function connectorEntries(id: string): ConnectorEntry[] {
  return packs.flatMap((pack) =>
    (pack.connectors ?? [])
      .filter((connector) => connector.id === id)
      .map((connector) => ({
        pack: pack.id,
        connector,
        connectivity: pack.methods[connector.method]?.connectivity ?? [],
      })),
  );
}

/** Every field of a document kind, at every depth. */
export function documentFields(kind: keyof typeof referenceKinds): FieldInfo[] {
  return documentReference(kind);
}

/** The field's path as written, with `*` for any name or list item. */
export function fieldPath(field: FieldInfo): string {
  return field.path.join(".");
}

/** The part of a field's docs link after `#`, for its row's id. */
export function anchorId(field: FieldInfo): string {
  return field.docs.split("#")[1] ?? "";
}

/** A value as definitions write it: YAML flow style, not JSON. */
export function shown(value: unknown): string {
  if (value === undefined) return "";
  if (Array.isArray(value)) return `[${value.map(shown).join(", ")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).map(([key, item]) => `${key}: ${shown(item)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return String(value);
}
