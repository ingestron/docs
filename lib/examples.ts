// The samples, read at build time: the CLI's starters to create a project
// from, this site's guides in examples/ that each show one idea, and the ADF
// pack's connector catalogue. What each uses comes from resolving it, through
// the CLI, so pages, `ingestron init` and VS Code agree.
// Generated files are not committed: a page that shows one generates the
// sample's output once, into a temporary folder.
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import {
  listSamples,
  readSample,
  run,
  sampleFacts,
  type Sample,
  type SampleFacts,
} from "@ingestron/cli";
import { recipesFolder } from "@ingestron/pack-adf";
import { parse } from "yaml";
import { pickLines, pickPath } from "./extract";

/** What a page needs to list a sample. */
export interface ExampleInfo extends Sample {
  facts: SampleFacts;
  /** The `ingestron init --template` name, for a starter. */
  template?: string;
}

/** The guides: this site's examples/ and the ADF connector catalogue, in their order. */
function guides(): Sample[] {
  const examples = join(process.cwd(), "examples");
  const order = (folder: string) =>
    (parse(readFileSync(join(folder, "sample.yaml"), "utf8")) as { order?: number }).order ??
    Number.MAX_SAFE_INTEGER;
  return [...readdirSync(examples).map((name) => join(examples, name)), recipesFolder]
    .sort((a, b) => order(a) - order(b))
    .map((folder) => ({
      ...readSample(folder, "guide"),
      ...(folder === recipesFolder && { name: "adf-native-connectors" }),
    }));
}

let resolved: ExampleInfo[] | undefined;

/**
 * Every sample, starters first, then the guides. Resolving them takes about a
 * second, and every connector page lists its samples, so it is done once.
 */
export function listExamples(): ExampleInfo[] {
  resolved ??= [...listSamples(), ...guides()].map((sample) => ({
    ...sample,
    facts: sampleFacts(sample.folder),
    ...(sample.kind === "starter" && { template: sample.name }),
  }));
  return resolved;
}

/** A sample's folder, by its name. Throws for a name that is not a sample. */
export function exampleFolder(name: string): string {
  const found = [...listSamples(), ...guides()].find((sample) => sample.name === name);
  if (!found) throw new Error(`No sample "${name}".`);
  return found.folder;
}

const generated = new Map<string, string>();

/** A folder holding what `ingestron apply` writes to the sample's `build/`. */
function generatedFolder(name: string): string {
  let out = generated.get(name);
  if (!out) {
    const folder = exampleFolder(name);
    out = mkdtempSync(join(tmpdir(), `ingestron-docs-${name}-`));
    let output = "";
    const code = run(["apply", "--no-diff", "--definitions", folder, "--out", out], {
      cwd: folder,
      write: (text) => (output += text),
    });
    if (code !== 0) throw new Error(`Example "${name}" does not generate:\n${output}`);
    generated.set(name, out);
  }
  return out;
}

/**
 * The text of one file of a sample; a `build/` path is generated output.
 * Throws when the file is missing or outside the sample.
 */
export function readExampleFile(name: string, file: string): string {
  const folder = exampleFolder(name);
  if (relative(folder, resolve(folder, file)).startsWith("..")) {
    throw new Error(`Example "${name}": "${file}" is outside the example.`);
  }
  const path = file.startsWith("build/")
    ? resolve(generatedFolder(name), file.slice("build/".length))
    : resolve(folder, file);
  if (!existsSync(path)) throw new Error(`Example "${name}" has no file "${file}".`);
  return readFileSync(path, "utf8");
}

/** Which part of a file an extract shows: a YAML or JSON path, or the lines between two markers. */
export type ExtractPart = { pick: string } | { from: string; to: string };

/**
 * Part of one file of a sample, as it is in the file. Throws, naming the
 * sample, file and path or marker, when the part is not there, so a page
 * cannot show an extract that has drifted from the file.
 */
export function readExampleExtract(name: string, file: string, part: ExtractPart): string {
  const text = readExampleFile(name, file);
  if ("pick" in part) {
    let found: string | undefined;
    try {
      found = pickPath(text, part.pick);
    } catch (error) {
      throw new Error(
        `Example "${name}": "${file}" cannot be read for pick "${part.pick}": ${(error as Error).message}.`,
      );
    }
    if (found === undefined)
      throw new Error(`Example "${name}": "${file}" has no path "${part.pick}".`);
    return found;
  }
  const found = pickLines(text, part.from, part.to);
  if ("missing" in found) {
    throw new Error(
      found.missing === part.from
        ? `Example "${name}": "${file}" has no line containing "${part.from}".`
        : `Example "${name}": "${file}" has no line containing "${part.to}" after "${part.from}".`,
    );
  }
  return found.lines;
}

/**
 * Part of a file in `ci-templates/`, the templates this repository publishes
 * for pipelines and platforms: the first line containing `from` through the
 * next containing `to`. Throws, naming the file and marker, when the file or
 * a marker is missing.
 */
export function readTemplateExtract(file: string, from: string, to: string): string {
  const folder = join(process.cwd(), "ci-templates");
  const path = resolve(folder, file);
  if (relative(folder, path).startsWith("..") || !existsSync(path)) {
    throw new Error(`Template: ci-templates has no file "${file}".`);
  }
  const found = pickLines(readFileSync(path, "utf8"), from, to);
  if ("missing" in found) {
    throw new Error(
      found.missing === from
        ? `Template: "${file}" has no line containing "${from}".`
        : `Template: "${file}" has no line containing "${to}" after "${from}".`,
    );
  }
  return found.lines;
}

/**
 * A generated folder of a sample, such as `build/adf`, as an indented
 * listing: folders first, then files, each sorted by name. Throws when the
 * sample generates no such folder.
 */
export function exampleTree(name: string, folder: string): string {
  const path = folder.replace(/\/+$/, "");
  if (!path.startsWith("build/")) {
    throw new Error(`Example "${name}": "${folder}" is not a generated folder under build/.`);
  }
  const root = resolve(generatedFolder(name), path.slice("build/".length));
  if (relative(generatedFolder(name), root).startsWith("..") || !existsSync(root)) {
    throw new Error(`Example "${name}" generates no folder "${folder}".`);
  }
  const listing = (at: string, depth: number): string[] => {
    const entries = readdirSync(at, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith("."))
      .sort(
        (a, b) =>
          Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name, "en"),
      );
    return entries.flatMap((entry) =>
      entry.isDirectory()
        ? [`${"  ".repeat(depth)}${entry.name}/`, ...listing(join(at, entry.name), depth + 1)]
        : [`${"  ".repeat(depth)}${entry.name}`],
    );
  };
  return [`${path}/`, ...listing(root, 1)].join("\n");
}

const requests = new Map<string, string>();

/** What `ingestron request --env <env>` prints for a sample. Throws when it fails. */
export function exampleRequest(name: string, env = "dev"): string {
  const key = `${name}\u0000${env}`;
  let text = requests.get(key);
  if (text === undefined) {
    const folder = exampleFolder(name);
    let output = "";
    const code = run(["request", "--env", env, "--definitions", folder], {
      cwd: folder,
      write: (chunk) => (output += chunk),
    });
    if (code !== 0) throw new Error(`Example "${name}": the request for ${env} fails:\n${output}`);
    text = output.trimEnd();
    requests.set(key, text);
  }
  return text;
}

/**
 * The named `## ` sections of a request, each with its heading, in the
 * order asked for. Throws, naming the sample and section, when one is missing.
 */
export function requestSections(name: string, env: string, titles: string[]): string {
  const text = exampleRequest(name, env);
  const sections = new Map<string, string>();
  for (const block of text.split(/\n(?=## )/)) {
    const title = /^## (.+)$/m.exec(block.split("\n")[0] ?? "")?.[1];
    if (title) sections.set(title, block.trimEnd());
  }
  return titles
    .map((title) => {
      const section = sections.get(title);
      if (section === undefined) {
        throw new Error(
          `Example "${name}": the request for ${env} has no section "${title}". It has: ${[...sections.keys()].join(", ")}.`,
        );
      }
      return section;
    })
    .join("\n\n");
}

/** The definition files of a sample, relative to it: everything but generated output. */
export function exampleFiles(name: string): string[] {
  const folder = exampleFolder(name);
  const files = (path: string): string[] =>
    readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
      // Hidden files are local state, except .gitkeep, which keeps a folder the example needs.
      entry.name === "build" || (entry.name.startsWith(".") && entry.name !== ".gitkeep")
        ? []
        : entry.isDirectory()
          ? files(join(path, entry.name))
          : [relative(folder, join(path, entry.name))],
    );
  return files(folder).sort();
}
