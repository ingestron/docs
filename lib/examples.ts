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

/** Every sample, starters first, then the guides. */
export function listExamples(): ExampleInfo[] {
  return [...listSamples(), ...guides()].map((sample) => ({
    ...sample,
    facts: sampleFacts(sample.folder),
    ...(sample.kind === "starter" && { template: sample.name }),
  }));
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

/** The definition files of a sample, relative to it: everything but generated output. */
export function exampleFiles(name: string): string[] {
  const folder = exampleFolder(name);
  const files = (path: string): string[] =>
    readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
      entry.name === "build" || entry.name.startsWith(".")
        ? []
        : entry.isDirectory()
          ? files(join(path, entry.name))
          : [relative(folder, join(path, entry.name))],
    );
  return files(folder).sort();
}
