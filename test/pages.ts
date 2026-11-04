// Helpers for tests that run a page as it shows itself: they read its sections,
// code blocks and commands, run the CLI in a copy of a sample, and merge the
// page's YAML fragments into it the way a reader adds them.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@ingestron/cli";
import { expect } from "vitest";
import { parse, stringify } from "yaml";
import { exampleFolder } from "../lib/examples.js";
import { contentFile, contentFolder } from "../lib/content-files.js";

/** A page's source, by its path under content/docs without folder groups, such as `how-to/add-a-source.mdx`. */
export const read = (path: string) => readFileSync(join(contentFolder, contentFile(path)), "utf8");

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

/** The command lines of the `sh` blocks in some text. */
export const commands = (text: string) =>
  fences(text, "sh").flatMap((block) => block.trimEnd().split("\n"));

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
