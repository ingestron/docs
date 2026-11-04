// A part of a file, as it is in the file: the node at a YAML or JSON path, or
// the lines from one marker to the next. Pages show generated files through
// these, so an extract cannot drift from what Ingestron writes, and a path
// or marker that is no longer there fails the build.
import { isMap, isPair, isScalar, isSeq, parseDocument, type Node, type Pair } from "yaml";

/**
 * A path's keys and indexes: `properties.activities[0]` is
 * `["properties", "activities", 0]`. A key holding a dot is quoted:
 * `resources["retail.refresh"]`.
 */
export function pathParts(path: string): (string | number)[] {
  const parts: (string | number)[] = [];
  const pattern = /([^.[\]]+)|\[(\d+)\]|\["([^"]+)"\]|(\.)/gy;
  let match: RegExpExecArray | null;
  let expectKey = true;
  while ((match = pattern.exec(path))) {
    const [, key, index, quoted, dot] = match;
    if (dot !== undefined) {
      if (expectKey) break;
      expectKey = true;
    } else if (key !== undefined) {
      if (!expectKey) break;
      parts.push(key);
      expectKey = false;
    } else {
      parts.push(index !== undefined ? Number(index) : quoted!);
      expectKey = false;
    }
    if (pattern.lastIndex === path.length && !expectKey) return parts;
  }
  throw new Error(`"${path}" is not a path such as properties.activities[0].name`);
}

/** The start of the line holding `offset`. */
const lineStart = (text: string, offset: number) => text.lastIndexOf("\n", offset - 1) + 1;

/**
 * The text of the node at `path` in a YAML or JSON file, from the start of
 * its line, so its indentation is kept: a key with its value, or a list item.
 * Undefined when the file has no such node.
 */
export function pickPath(text: string, path: string): string | undefined {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) throw new Error(`the file does not parse: ${doc.errors[0]!.message}`);
  let node: unknown = doc.contents;
  let found: Pair<Node, Node> | Node | undefined;
  for (const part of pathParts(path)) {
    if (typeof part === "number") {
      if (!isSeq(node)) return undefined;
      found = node.items[part] as Node | undefined;
      node = found;
    } else {
      if (!isMap(node)) return undefined;
      found = node.items.find((pair) => isScalar(pair.key) && String(pair.key.value) === part) as
        Pair<Node, Node> | undefined;
      node = found?.value;
    }
    if (found === undefined) return undefined;
  }
  const [start, end] = isPair(found)
    ? [found.key?.range?.[0], (found.value ?? found.key)?.range?.[1]]
    : [found?.range?.[0], found?.range?.[1]];
  if (start === undefined || end === undefined) return undefined;
  const from = lineStart(text, start);
  // A key that opens a list item keeps its indentation, but not the item's dash.
  const lead = text.slice(from, start);
  const indent = isPair(found) ? lead.replace(/[^\t ]/g, " ") : lead;
  return (indent + text.slice(start, end)).trimEnd();
}

/**
 * The lines from the first holding `from` through the next holding `to`,
 * which may be the same line when `to` follows `from` on it; or the marker
 * no line holds.
 */
export function pickLines(
  text: string,
  from: string,
  to: string,
): { lines: string } | { missing: string } {
  const lines = text.split("\n");
  const first = lines.findIndex((line) => line.includes(from));
  if (first === -1) return { missing: from };
  const rest = lines[first]!.slice(lines[first]!.indexOf(from) + from.length);
  const last = rest.includes(to)
    ? first
    : lines.findIndex((line, index) => index > first && line.includes(to));
  if (last === -1) return { missing: to };
  return { lines: lines.slice(first, last + 1).join("\n") };
}
