// Helpers for tests that run a page as it shows itself: they read its sections,
// code blocks and commands, run the CLI in a copy of a sample, and merge the
// page's YAML fragments into it the way a reader adds them.
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@ingestron/cli";
import { expect } from "vitest";
import { parse, stringify } from "yaml";
import { exampleFolder } from "../lib/examples.js";
import { contentFile, contentFolder, sharedFolder } from "../lib/content-files.js";
import { pageText } from "../lib/platform-text.js";
import { movedPages, sharedPageNamed, sharedPages } from "../lib/platforms.js";

/**
 * A page's text, by its path under content/docs without folder groups, such as
 * `concepts/layers.mdx`; a platform page as its platform shows it, includes
 * expanded. A shared page's source, every platform's text, is under content/:
 * `shared/guides/add-a-source.mdx`, or by its name, `shared/add-a-source.mdx`;
 * so is a shared page read by its old URL, `how-to/configure-a-standard.mdx`.
 */
export const read = (path: string) => {
  if (path.startsWith("shared/")) {
    const direct = join(contentFolder, "..", path);
    if (existsSync(direct)) return readFileSync(direct, "utf8");
    const key = sharedPageNamed(path.slice("shared/".length).replace(/\.mdx$/, ""));
    if (!key) throw new Error(`No shared page ${path}.`);
    return readFileSync(join(sharedFolder, `${key}.mdx`), "utf8");
  }
  // A shared page by its old URL: the first platform copy's front matter, then
  // the shared source with every platform's text.
  const moved = movedPages[path.replace(/\.mdx$/, "")];
  if (moved) {
    const stub = join(
      contentFolder,
      sharedPages[moved]!.platforms[0]!,
      `(${sharedPages[moved]!.section})`,
      `${moved.split("/").at(-1)}.mdx`,
    );
    const front = /^---\n[\s\S]*?\n---\n/.exec(readFileSync(stub, "utf8"))![0];
    return `${front}\n${readFileSync(join(sharedFolder, `${moved}.mdx`), "utf8")}`;
  }
  return pageText(join(contentFolder, contentFile(path)));
};

export /** The page's heading anchors: `[#id]` where given, else the heading's slug. */
function anchors(text: string): Map<string, string> {
  const found = new Map<string, string>();
  let fenced = false;
  for (const line of text.split("\n")) {
    if (line.trimStart().startsWith("```")) fenced = !fenced;
    const heading = !fenced && /^#{2,6} (.*?)(?: \[#([^\]]+)\])?$/.exec(line);
    if (!heading) continue;
    const slug = heading[1]!
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .trim()
      .replace(/ +/g, "-");
    found.set(heading[2] ?? slug, heading[1]!);
  }
  return found;
}

/** The text under a heading, such as `## Generate and inspect`, up to the next heading at its level or above. */
export function section(text: string, heading: string): string {
  const level = /^#+/.exec(heading)![0].length;
  const lines = text.split("\n");
  let fenced = false;
  const headings = lines.map((line) => {
    if (line.trimStart().startsWith("```")) fenced = !fenced;
    return !fenced && /^#+ /.test(line) ? /^#+/.exec(line)![0].length : 0;
  });
  const start = lines.findIndex(
    (line, index) =>
      (line === heading || line.startsWith(`${heading} [#`)) && headings[index] === level,
  );
  if (start === -1) throw new Error(`The page has no heading "${heading}".`);
  const end = headings.findIndex((found, index) => index > start && found > 0 && found <= level);
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
}

/**
 * The fenced blocks of one language in some text, in order. A block indented
 * in a list item comes back without the item's indentation.
 */
export const fences = (text: string, lang: string) =>
  [...text.matchAll(/^( *)```(\S*)[^\n]*\n([\s\S]*?)^\1```$/gm)]
    .filter((match) => match[2] === lang)
    .map((match) =>
      match[3]!
        .split("\n")
        .map((line) => line.slice(Math.min(match[1]!.length, /^ */.exec(line)![0].length)))
        .join("\n"),
    );

/** The command lines of the `sh` blocks in some text, with each `\` continuation joined to its line. */
export const commands = (text: string) =>
  fences(text, "sh").flatMap((block) =>
    block
      .trimEnd()
      .replace(/ \\\n\s*/g, " ")
      .split("\n"),
  );

/**
 * The definition files of a project folder, relative to it, as parsed YAML: what
 * a page's `init` wrote, to compare with a sample. README.md, which holds the
 * day it was written, and generated files are left out.
 */
export function definitions(folder: string): Record<string, unknown> {
  const found: Record<string, unknown> = {};
  const walk = (at: string) => {
    for (const entry of readdirSync(join(folder, at), { withFileTypes: true })) {
      const path = at ? `${at}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name !== "build") walk(path);
      } else if (/\.ya?ml$/.test(entry.name) && entry.name !== "sample.yaml")
        found[path] = parse(readFileSync(join(folder, path), "utf8"));
    }
  };
  walk("");
  return found;
}

/** The one `ingestron` command, among some lines, that starts with a prefix. */
export function command(lines: string[], prefix: string): string[] {
  const found = lines.filter((line) => line.startsWith(`ingestron ${prefix}`));
  expect(found, `one "ingestron ${prefix}" command`).toHaveLength(1);
  return found[0]!.split(" ").slice(1);
}

/** Runs the CLI in a folder and returns its exit code and what it printed. */
export function cli(cwd: string, args: string[]): { code: number; output: string } {
  let output = "";
  const code = run(args, { cwd, write: (text) => (output += text) });
  return { code, output };
}

/** A copy of a sample, to change and generate. */
export function copy(name: string): string {
  const cwd = mkdtempSync(join(tmpdir(), `docs-page-${name}-`));
  cpSync(exampleFolder(name), cwd, { recursive: true });
  return cwd;
}

/** Merges a YAML fragment into a definition file, the way a reader adds it. */
export function merge(file: string, fragment: string): void {
  const into = (target: Record<string, unknown>, source: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(source)) {
      const existing = target[key];
      if (value && typeof value === "object" && !Array.isArray(value) && existing)
        into(existing as Record<string, unknown>, value as Record<string, unknown>);
      else target[key] = value;
    }
  };
  const document = parse(readFileSync(file, "utf8"));
  into(document, parse(fragment));
  writeFileSync(file, stringify(document));
}

/** Each `<Request>` in some text: the sample, environment and sections it shows. */
export function requestUses(text: string): { name: string; env: string; sections?: string[] }[] {
  return [...text.matchAll(/<Request\s([\s\S]*?)\/>/g)].map(([, props]) => {
    const name = /name="([^"]+)"/.exec(props!)?.[1];
    if (!name) throw new Error(`<Request ${props}/> names no sample`);
    const sections = /sections=\{(\[[\s\S]*?\])\}/.exec(props!)?.[1];
    return {
      name,
      env: /env="([^"]+)"/.exec(props!)?.[1] ?? "dev",
      ...(sections && { sections: JSON.parse(sections) as string[] }),
    };
  });
}

/** Where each page of the old Platforms area is now: its file, then any page it was split into. */
export const movedPlatformPages: Record<string, string[]> = {
  synapse: ["synapse/index.mdx", "synapse/deploy.mdx", "adf-synapse/load-with-adf.mdx"],
  databricks: ["databricks/index.mdx"],
  "databricks-deploy": ["databricks/deploy.mdx"],
  adf: ["adf/index.mdx"],
  "adf-deploy": ["adf/deploy.mdx"],
  "adf-pipelines": ["adf/pipelines.mdx"],
  "landing-only": ["adf/land-files-only.mdx"],
  // DuckDB's cloud-project sections moved to the DuckDB combination's guide.
  duckdb: ["duckdb/index.mdx", "adf-duckdb/load-with-adf.mdx"],
  "duckdb-in-azure": ["adf-duckdb/load-with-adf.mdx", "adf-duckdb/deploy.mdx"],
};

/** An old Platforms page's file now, by its old name, such as `landing-only`. */
export const platformFile = (old: string) => movedPlatformPages[old]![0]!;
