// What each code block is, so the site can say so before the reader reads it:
// a command to run, a file to write, what Ingestron prints, or a file
// Ingestron writes. Pages carry no extra markup; the kind comes from the
// fence's language, its title and, for an <Example>, its path. The rule:
//
//   1. A fence marked `kind="run|write|prints|writes|plain"` is that kind. The
//      mark is only for a block the rest cannot place, such as a JSON payload
//      a server returns (`plain`: no kind, no label).
//   2. `sh`, `bash`, `shell`, `console` and `powershell` fences are commands:
//      "run". Each command's first line shows a `$` the stylesheet draws, so
//      it is never copied and tests read the commands as written.
//   3. A `text` fence with a title is a named file, such as `.gitignore`:
//      "write". Without a title it is what a command prints: "prints", as
//      are a folder listing and a DuckDB result table. A dotenv file is a
//      `dotenv` fence, so rule 4 places it.
//   4. Any other language (yaml, json, csv, dotenv, sql, python) is a file the
//      reader writes: "write".
//   5. An <Example> under `build/` is a file Ingestron generates: "writes".
//      Any other <Example> file is "write".

export type BlockKind = "run" | "write" | "prints" | "writes" | "plain";

const kinds: readonly BlockKind[] = ["run", "write", "prints", "writes", "plain"];
const commandLanguages = new Set(["sh", "bash", "shell", "console", "powershell"]);
const outputLanguages = new Set(["text", "txt", "plaintext"]);

/** The kind a fence marks on itself with `kind="…"`, if it does. */
function marked(meta: string | undefined): BlockKind | undefined {
  const found = /(?:^|\s)kind="([a-z]+)"/.exec(meta ?? "")?.[1];
  return kinds.find((kind) => kind === found);
}

/** The kind of a fenced block: its language, whether it has a title, and its meta string. */
export function blockKind(lang: string | undefined, title?: unknown, meta?: string): BlockKind {
  const mark = marked(meta);
  if (mark) return mark;
  if (lang && commandLanguages.has(lang)) return "run";
  if (!lang || outputLanguages.has(lang))
    return typeof title === "string" && title ? "write" : "prints";
  return "write";
}

/** The kind of an `<Example>` file, by its path in the project. */
export function exampleKind(file: string): BlockKind {
  return file.startsWith("build/") ? "writes" : "write";
}

/**
 * Whether a line of a command block starts a command, and so shows the `$`
 * prompt: not a comment, and not the continuation of a line ending in `\`.
 */
export function startsCommand(lines: string[], index: number): boolean {
  const line = lines[index]?.trim() ?? "";
  if (!line || line.startsWith("#")) return false;
  return !(index > 0 && lines[index - 1]!.trimEnd().endsWith("\\"));
}

/** The part of Shiki's transformer context this reads. */
interface Context {
  source: string;
  options: { lang: string; meta?: { __raw?: string; title?: unknown } };
}
interface Element {
  properties: Record<string, unknown>;
}

/**
 * A Shiki transformer for Fumadocs' `rehypeCodeOptions`: puts the block's kind
 * on its `<pre>` as `data-kind`, and the `cmd` class on each line of a command
 * block that starts a command.
 */
export const transformerBlockKind = {
  name: "ingestron:block-kind",
  pre(this: Context, node: Element) {
    const { lang, meta } = this.options;
    node.properties.dataKind = blockKind(lang, meta?.title, meta?.__raw);
  },
  line(this: Context, node: Element, line: number) {
    if (blockKind(this.options.lang, this.options.meta?.title, this.options.meta?.__raw) !== "run")
      return;
    if (startsCommand(this.source.split("\n"), line - 1))
      node.properties.class = `${String(node.properties.class ?? "line")} cmd`;
  },
};
