// Names each Markdown table and highlighted code block, so its scrolling
// frame is announced as more than "region": a code block by its file name, or
// by what it holds and the heading it is under; a table by that heading. The
// names go on as `data-frame-label`, which components/mdx.tsx moves onto the
// frame. Runs after highlighting, with Fumadocs' `addLanguageClass` on.

/** The part of a hast node this plugin reads and writes. */
interface Node {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
}

/** What a block holds, by its fence language. */
const kinds: Record<string, string> = {
  sh: "Commands",
  bash: "Commands",
  shell: "Commands",
  powershell: "PowerShell commands",
  text: "Output",
  txt: "Output",
  plaintext: "Output",
  yaml: "YAML",
  yml: "YAML",
  json: "JSON",
  sql: "SQL",
  python: "Python",
  csv: "CSV",
  bicep: "Bicep",
};

const text = (node: Node): string =>
  node.type === "text" ? (node.value ?? "") : (node.children ?? []).map(text).join("");

/** The fence language Fumadocs put on the block's `<code>` as `language-<lang>`. */
function language(pre: Node): string | undefined {
  const code = pre.children?.find((child) => child.tagName === "code");
  const classes = code?.properties?.className;
  const found = (Array.isArray(classes) ? classes : [])
    .map(String)
    .find((name) => name.startsWith("language-"));
  return found?.slice("language-".length);
}

/** A block's name: its title, else what it holds and the heading it is under. */
export function codeName(lang: string | undefined, title: unknown, heading?: string): string {
  if (typeof title === "string" && title) return title;
  const kind = kinds[lang ?? ""] ?? (lang ? lang.toUpperCase() : "Code");
  return heading ? `${kind}: ${heading}` : kind;
}

/** A table's name: the heading it is under. */
export function tableName(heading?: string): string {
  return heading ? `Table: ${heading}` : "Table";
}

function walk(node: Node, state: { heading?: string }): void {
  if (node.type === "element" && /^h[2-6]$/.test(node.tagName ?? "")) {
    state.heading = text(node).trim();
    return;
  }
  if (node.type === "element" && node.tagName === "pre") {
    node.properties = {
      ...node.properties,
      dataFrameLabel: codeName(language(node), node.properties?.title, state.heading),
    };
    return;
  }
  if (node.type === "element" && node.tagName === "table") {
    node.properties = { ...node.properties, dataFrameLabel: tableName(state.heading) };
    return;
  }
  for (const child of node.children ?? []) walk(child, state);
}

/** Adds `data-frame-label` to every highlighted `<pre>` and every `<table>`, in reading order. */
export function rehypeFrameNames() {
  return (tree: Node) => walk(tree, {});
}
