// Reference data read from the packages at build time, so pages match the code.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRecipe, projectRoutes, projectSources, type ProjectRoute } from "@ingestron/core";
import {
  documentReference,
  intentPaths,
  intentUseOf,
  methodReference,
  platformSectionReference,
  referenceKinds,
  type Connector,
  type FieldInfo,
  type IntentUse,
  type Pack,
} from "@ingestron/definitions";
import { adf } from "@ingestron/pack-adf";
import { databricks } from "@ingestron/pack-databricks";
import { duckdb } from "@ingestron/pack-duckdb";
import { synapse } from "@ingestron/pack-synapse";
import { parse } from "yaml";
import { contentFile, contentFolder } from "./content-files";

/** The packs the CLI provides, in the order a standard usually lists them. */
export const packs: Pack[] = [databricks, adf, synapse, duckdb];

/** A pack the CLI provides, by id; throws for any other. */
export function packOf(id: string): Pack {
  const found = packs.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No pack "${id}".`);
  return found;
}

/** Each pack's reference page. */
export function packPages(): { pack: string; url: string }[] {
  return packs.map((pack) => ({ pack: pack.id, url: `/docs/reference/packs/${pack.id}` }));
}

/** A page's title, from its front matter, by its path under `/docs/`. */
export function pageTitle(path: string): string {
  const text = readFileSync(join(contentFolder, contentFile(`${path}.mdx`)), "utf8");
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

/**
 * A pack's platform defaults: each Platform field the pack declares it reads
 * (its `platformFields`), in the pack's order, with the default the field's
 * description states. A field the pack's own section of the Platform has
 * (`databricks.mode` for `mode`) is shown there, where it is written now.
 * Fields with no default, such as `run_as`, are left out. Throws for a pack
 * that reads no Platform field, or for a field neither describes.
 */
export function platformDefaults(pack: string): { field: FieldInfo; default: string }[] {
  const found = packOf(pack);
  const read = found.platformFields;
  if (!read?.length) throw new Error(`The ${pack} pack reads no platform defaults.`);
  const fields = documentReference("Platform");
  const section = platformSectionFields(pack);
  return read.flatMap((path) => {
    const field =
      section.find((candidate) => fieldPath(candidate) === `${pack}.${path}`) ??
      section.find((candidate) => fieldPath(candidate) === path) ??
      fields.find((candidate) => fieldPath(candidate) === path);
    if (!field) throw new Error(`The Platform document has no field "${path}".`);
    const stated = /Default: (.+?)\.?$/.exec(field.description ?? "")?.[1];
    return stated ? [{ field, default: stated }] : [];
  });
}

/** The fields of a pack's own section of the Platform, such as `databricks.run_as`; none when it has none. */
export function platformSectionFields(pack: string): FieldInfo[] {
  return platformSectionReference(packOf(pack));
}

/** One row of a pack's intent support: a path, the values that share one entry, and the entry. */
export interface IntentRow {
  path: string;
  /** The values the entry covers, in the vocabulary's order; `["*"]` for a path that takes any text. */
  values: string[];
  use: IntentUse;
}

/**
 * What a pack does with each intent path and value, from the pack's own
 * `intent` (each value takes its own entry, else its path's, else a parent
 * path's, as resolving does). Values of one path that share an entry are one
 * row. Throws when a value has no entry, so a pack's gap fails the build.
 */
export function intentRows(pack: string): IntentRow[] {
  const found = packOf(pack);
  const rows: IntentRow[] = [];
  for (const [path, values] of Object.entries(intentPaths)) {
    for (const value of values) {
      const use = intentUseOf(found, path, value === "*" ? undefined : value);
      if (!use) throw new Error(`The ${pack} pack says nothing about ${path}: ${value}.`);
      const last = rows.at(-1);
      if (last?.path === path && JSON.stringify(last.use) === JSON.stringify(use))
        last.values.push(value);
      else rows.push({ path, values: [value], use });
    }
  }
  return rows;
}

/** One entry of a method's own `intent`: where the method differs from its pack. */
export interface MethodIntentRow {
  method: string;
  path: string;
  /** Undefined when the entry covers the whole path. */
  value?: string;
  use: IntentUse;
}

/** Each method's own intent entries, in the pack's method order, then the vocabulary's. */
export function methodIntentRows(pack: string): MethodIntentRow[] {
  const listed = Object.keys(intentPaths);
  const rank = (path: string) => {
    const at = listed.findIndex((item) => item === path || item.startsWith(`${path}.`));
    return at < 0 ? listed.length : at;
  };
  return Object.entries(packOf(pack).methods).flatMap(([method, info]) =>
    Object.entries(info.intent ?? {})
      .map(([key, use]) => {
        const [path, value] = key.split("=") as [string, string | undefined];
        return { method, path, ...(value !== undefined && { value }), use };
      })
      .sort((a, b) => {
        const values = intentPaths[a.path] ?? [];
        return (
          rank(a.path) - rank(b.path) ||
          values.indexOf(a.value ?? "") - values.indexOf(b.value ?? "")
        );
      }),
  );
}

/** Intent written as `path: value` pairs, such as `["load.mode: files"]`; a list is one value. */
export function intentPairs(intent: object, prefix = ""): string[] {
  return Object.entries(intent).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? intentPairs(value, path)
      : [`${path}: ${shown(value)}`];
  });
}

/**
 * A method's settings that are other names for intent, each as a sentence
 * part: `` `sequence_by` is `sequence` `` or `` `mode: upsert` is `history: latest` ``.
 */
export function aliasTexts(pack: string, method: string): string[] {
  const aliases = packOf(pack).methods[method]?.aliases ?? {};
  return Object.entries(aliases).flatMap(([setting, alias]) =>
    "path" in alias
      ? [`\`${setting}\` is \`${alias.path}\``]
      : Object.entries(alias.values).map(
          ([value, intent]) => `\`${setting}: ${value}\` is \`${intentPairs(intent).join(", ")}\``,
        ),
  );
}

/** Where each intent path's meaning is described: the field of a document that writes it. */
const intentFields: Record<string, ["Standard" | "Flow", string]> = {
  "load.mode": ["Standard", "load.default"],
  "load.cursor": ["Flow", "load.cursor"],
  "load.deletes.mode": ["Standard", "load.deletes"],
  "load.deletes.when": ["Flow", "load.deletes.when"],
  history: ["Standard", "layers.*.history"],
  sequence: ["Flow", "sequence"],
  audit: ["Standard", "audit.*.value"],
  rescued: ["Standard", "rescued"],
  "retention.time_travel": ["Standard", "retention.time_travel"],
  "retention.log": ["Standard", "retention.log"],
  "retention.landed_files": ["Standard", "retention.landed_files"],
  "storage.clustering": ["Standard", "storage.clustering"],
  "storage.features": ["Standard", "storage.features"],
  "operations.schedule": ["Standard", "operations.schedule.per"],
  "operations.trigger": ["Standard", "operations.trigger"],
  "operations.retries": ["Standard", "operations.retries"],
  "operations.timeout": ["Standard", "operations.timeout"],
  "operations.alerts": ["Standard", "operations.alerts.on"],
  "operations.concurrency": ["Standard", "operations.concurrency"],
  "quality.results": ["Standard", "quality.results"],
};

/** One intent path: what it means, its values with theirs, and the places that can write it. */
export interface IntentPathInfo {
  path: string;
  /** The field that describes it, in the documents reference. */
  field: FieldInfo;
  values: { value: string; description?: string }[];
  /** The places that write it, in the order they win: `standard`, `layer`, `flow`, `flow table`, `transform`. */
  places: string[];
}

/**
 * Each intent path of the vocabulary, in its order, described by the
 * documents' own fields. Throws for a path no field describes, so a new path
 * fails the build until it is described.
 */
export function intentVocabulary(): IntentPathInfo[] {
  const fields = {
    Standard: documentReference("Standard"),
    Flow: documentReference("Flow"),
    Transform: documentReference("Transform"),
  };
  const has = (kind: keyof typeof fields, path: string) =>
    fields[kind].some((field) => fieldPath(field) === path);
  return Object.entries(intentPaths).map(([path, values]) => {
    const [kind, at] = intentFields[path] ?? [];
    const field = kind && fields[kind].find((candidate) => fieldPath(candidate) === at);
    if (!field) throw new Error(`No field describes the intent path "${path}".`);
    const meanings = new Map(
      (field.values ?? []).map((item) => [String(item.value), item.description]),
    );
    // The standard writes the load mode as `load.default`, and deletes as
    // `load.deletes`; a cursor or a delete condition only for one flow.
    const inStandard = (
      { "load.mode": "load.default", "load.deletes.mode": "load.deletes" } as Record<string, string>
    )[path];
    const places = [
      has("Standard", inStandard ?? path) && "standard",
      has("Standard", `layers.*.${path}`) && "layer",
      has("Flow", path) && "flow",
      has("Flow", `tables.*.${path}`) && "flow table",
      has("Transform", path) && "transform",
    ].filter((place): place is string => typeof place === "string");
    return {
      path,
      field,
      values: values.map((value) => ({
        value,
        ...(meanings.get(value) && { description: meanings.get(value) }),
      })),
      places,
    };
  });
}
