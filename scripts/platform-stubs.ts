// Writes each platform's Connectors section from the connector facts: a stub
// per connector the platform loads (front matter and one include of
// content/shared/connectors/<id>.mdx), the catalogue's stub, the section's
// meta.json, and the old /docs/connectors/<id> URLs as pages that list the
// platforms. `pnpm stubs` writes them; test/connector-sites.test.ts fails
// when the files on disk differ.
//   pnpm stubs           write the files, removing stale ones
//   pnpm stubs --check   exit 1 when a file differs
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { projectSources } from "@ingestron/core";
import { contentFolder } from "../lib/content-files";
import { categoryAnchor, connectorDescription, sourceCategories } from "../lib/connector-page";
import { platforms } from "../lib/platforms";
import { connectorEntries, connectorsFor } from "../lib/reference";

/** A front matter value, quoted when YAML would read it otherwise. */
const value = (text: string) =>
  /[:#]|^[\s"'[{>|*&!%@`-]/.test(text) ? JSON.stringify(text) : text;

const front = (title: string, description: string) =>
  `---\ntitle: ${value(title)}\ndescription: ${value(description)}\n---\n\n`;

/** Every generated file, by its path under content/docs, with its text. */
export function stubFiles(): Map<string, string> {
  const files = new Map<string, string>();
  const sources = projectSources();
  const title = (id: string) => connectorEntries(id)[0]!.connector.title;
  for (const platform of platforms) {
    const ids = connectorsFor(platform.id);
    // A site that loads no source has no Connectors section (lib/platforms.ts's sectionsOf).
    if (ids.length === 0) continue;
    const folder = `${platform.id}/connectors`;
    const pages = sourceCategories().flatMap((category) => {
      const inCategory = sources
        .filter((source) => source.category === category && ids.includes(source.id))
        .map((source) => source.id);
      if (inCategory.length === 0) return [];
      return [
        `[${category}](/docs/${platform.id}/connectors#${categoryAnchor(category)})`,
        ...inCategory,
      ];
    });
    files.set(
      `${folder}/meta.json`,
      `${JSON.stringify(
        {
          title: "Connectors",
          description: `The sources ${platform.title} can load, and how each one is read.`,
          root: true,
          pages: ["index", ...pages],
        },
        null,
        2,
      )}\n`,
    );
    files.set(
      `${folder}/index.mdx`,
      `${front("Connectors", `The sources ${platform.title} can load, and how each one is read.`)}<include>../../../shared/connectors/index.mdx</include>\n`,
    );
    for (const id of ids)
      files.set(
        `${folder}/${id}.mdx`,
        `${front(title(id), connectorDescription(id, platform.id))}<include>../../../shared/connectors/${id}.mdx</include>\n`,
      );
  }
  files.set(
    "(moved)/connectors/index.mdx",
    `${front("Connectors", "The sources Ingestron can read: each platform has its own list.")}<ConnectorChooser />\n`,
  );
  for (const source of sources)
    files.set(
      `(moved)/connectors/${source.id}.mdx`,
      `${front(title(source.id), `How ${title(source.id)} is read: each platform that loads it has its own page.`)}<ConnectorChooser id="${source.id}" />\n`,
    );
  return files;
}

/** The folders the generator owns; a file in them it does not write is stale. */
const owned = () => [
  ...platforms.map((platform) => `${platform.id}/connectors`),
  "(moved)/connectors",
];

function main(check: boolean): number {
  const files = stubFiles();
  const differ: string[] = [];
  for (const [path, text] of files) {
    const file = join(contentFolder, path);
    const now = existsSync(file) ? readFileSync(file, "utf8") : undefined;
    if (now === text) continue;
    differ.push(path);
    if (!check) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    }
  }
  for (const folder of owned()) {
    const at = join(contentFolder, folder);
    if (!existsSync(at)) continue;
    for (const entry of readdirSync(at)) {
      const path = `${folder}/${entry}`;
      if (files.has(path)) continue;
      differ.push(`${path} (stale)`);
      if (!check) rmSync(join(at, entry));
    }
    // A site that no longer loads any source loses the folder too.
    if (!check && readdirSync(at).length === 0) rmSync(at, { recursive: true });
  }
  if (check && differ.length > 0) {
    console.error(
      `✗ ${differ.length} connector stubs differ; run pnpm stubs:\n${differ.join("\n")}`,
    );
    return 1;
  }
  console.log(check ? "✓ connector stubs are current" : `wrote ${differ.length} files`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  process.exitCode = main(process.argv.includes("--check"));
