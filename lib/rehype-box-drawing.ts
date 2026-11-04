// Marks each highlighted code block that holds box-drawing characters, such
// as a DuckDB result, so the stylesheet can set the line height at which the
// box's lines join from one row to the next.

/** The part of a hast node this plugin reads and writes. */
interface Node {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
}

const boxDrawing = /[─-╿]/;

const text = (node: Node): string =>
  node.type === "text" ? (node.value ?? "") : (node.children ?? []).map(text).join("");

function mark(node: Node): void {
  if (node.type === "element" && node.tagName === "pre" && boxDrawing.test(text(node))) {
    node.properties = { ...node.properties, dataBoxDrawing: "" };
    return;
  }
  for (const child of node.children ?? []) mark(child);
}

/** Adds `data-box-drawing` to every `<pre>` whose text has a box-drawing character; Fumadocs moves it to the block's frame. */
export function rehypeBoxDrawing() {
  return (tree: Node) => mark(tree);
}
