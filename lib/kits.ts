// Published standards (kits), read at build time from the installed
// @ingestron/standards package, so each kit's page shows the kit's own files.
// What a REPLACE_ME stands for comes from the same field reference the
// editor's hover uses (`ProjectSnapshot.replaceMeHelp`).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ProjectSnapshot, type ReplaceMeHelp } from "@ingestron/authoring";
import { installedKits, packs as corePacks, type Kit } from "@ingestron/core";
import { loadDefinitions, type Origin } from "@ingestron/definitions";
import { isMap, isScalar, isSeq, parseDocument, type Node } from "yaml";

/** The `kits` folder of the installed @ingestron/standards package. */
export const kitsFolder = join(process.cwd(), "node_modules/@ingestron/standards/kits");

let found: Kit[] | undefined;

/** Every installed kit version, by id and then version, oldest first. */
export function kits(): Kit[] {
  found ??= installedKits(kitsFolder);
  return found;
}

/** The newest version of each kit that is not a preview, in order of id. */
export function latestKits(): Kit[] {
  const ids = [...new Set(kits().map((kit) => kit.id))];
  return ids.map(kitById);
}

/** A kit's newest installed version that is not a preview, as `ingestron init --kit <id>` takes it offline. */
export function kitById(id: string): Kit {
  const kit = kits()
    .filter((item) => item.id === id && item.features === "ga")
    .at(-1);
  if (!kit) throw new Error(`No kit "${id}" is installed.`);
  return kit;
}

/** A kit's page: `/docs/how-to/kits/duckdb-local-medallion` for `duckdb/local-medallion`. */
export function kitPage(id: string): string {
  return `/docs/how-to/kits/${id.replace("/", "-")}`;
}

/** A file of a kit, as it is in the package. */
export function kitFile(kit: Kit, file: string): string {
  return readFileSync(join(kit.folder, file), "utf8");
}

/** A value still `REPLACE_ME` in a kit's file, and what it stands for. */
export interface Blank {
  /** Where `REPLACE_ME` starts in the file's text. */
  offset: number;
  /** The file's line, from 1. */
  line: number;
  /** The value's JSON Pointer, such as `/databricks/run_as/service_principal_name`. */
  pointer: string;
  /** The field it fills and the help the field gives; undefined when no field describes it. */
  help?: ReplaceMeHelp;
}

const snapshots = new Map<string, ProjectSnapshot>();

/** The kit's folder opened as a project, as the editor opens it, once. */
function snapshotOf(kit: Kit): ProjectSnapshot {
  let snapshot = snapshots.get(kit.folder);
  if (!snapshot) {
    snapshot = ProjectSnapshot.open(kit.folder);
    snapshots.set(kit.folder, snapshot);
  }
  return snapshot;
}

/**
 * Each `REPLACE_ME` value in a YAML file of a kit, in file order, with the
 * help the editor's hover gives for it. A value under
 * `environments.<name>` of project.yaml is explained for that environment.
 */
export function kitBlanks(kit: Kit, file: string): Blank[] {
  const text = kitFile(kit, file);
  const snapshot = snapshotOf(kit);
  const blanks: Blank[] = [];
  const visit = (node: Node | null | undefined, path: string[]) => {
    if (isMap(node))
      for (const pair of node.items)
        visit(pair.value as Node | null, [
          ...path,
          String(isScalar(pair.key) ? pair.key.value : pair.key),
        ]);
    else if (isSeq(node))
      node.items.forEach((item, index) => visit(item as Node | null, [...path, String(index)]));
    else if (isScalar(node) && node.value === "REPLACE_ME" && node.range) {
      const pointer = `/${path.map((key) => key.replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
      const environment =
        file === "project.yaml" && path[0] === "environments" ? path[1] : undefined;
      const help = snapshot.replaceMeHelp(file, pointer, environment);
      blanks.push({
        offset: node.range[0],
        line: text.slice(0, node.range[0]).split("\n").length,
        pointer,
        ...(help && { help }),
      });
    }
  };
  visit(parseDocument(text).contents as Node | null, []);
  return blanks;
}

/** One value of a table's intent in a kit, and where it came from. */
export interface KitIntent {
  table: string;
  layer: string;
  /** The intent path, such as `history`. */
  path: string;
  /** The value as the editor's hover shows it, such as `latest` or `[loaded_at, source_file]`. */
  value: string;
  origin: Origin;
  /** Whether the table is a flow's or a transform's, for naming where a value came from. */
  kind: "Flow" | "Transform";
}

/**
 * Each table's intent, resolved for the kit's first environment as `plan`
 * resolves it, in the order of the tables and of their intent paths. Audit
 * columns are shown by their values.
 */
export function kitIntent(kit: Kit): KitIntent[] {
  const environment = snapshotOf(kit).environments[0];
  const result = loadDefinitions(kit.folder, { packs: corePacks, environment });
  if (!result.model) throw new Error(`The kit ${kit.id}@${kit.version} does not resolve.`);
  return result.model.tables.flatMap((table) =>
    Object.entries(table.intentOrigins).map(([path, origin]) => ({
      table: table.name,
      layer: table.layer,
      path,
      value: written(valueAt(table.intent, path)),
      origin,
      kind: table.origin.kind === "Transform" ? "Transform" : "Flow",
    })),
  );
}

function valueAt(intent: object, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
      intent,
    );
}

function written(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => (item && typeof item === "object" && "value" in item ? String(item.value) : written(item))).join(", ")}]`;
  return String(value);
}
