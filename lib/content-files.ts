// Pages sit in folder groups such as `how-to/(build)/`, which set their area
// but not their URL. These helpers find a page's file from its URL path.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** The folder that holds the pages. */
export const contentFolder = join(process.cwd(), "content/docs");

let files: Map<string, string> | undefined;

/**
 * A file's path under content/docs, from its path without folder groups:
 * `how-to/(build)/check-in-ci.mdx` for `how-to/check-in-ci.mdx`. A path that
 * names a file, or names none, comes back as it is.
 * @example readFileSync(join(contentFolder, contentFile("troubleshooting.mdx")), "utf8")
 */
export function contentFile(path: string): string {
  if (existsSync(join(contentFolder, path))) return path;
  files ??= new Map(
    readdirSync(contentFolder, { recursive: true, encoding: "utf8" }).map((file) => [
      withoutGroups(file.replaceAll("\\", "/")),
      file,
    ]),
  );
  return files.get(withoutGroups(path)) ?? path;
}

/** A path with its folder groups, such as `(build)/`, left out. */
export const withoutGroups = (path: string) =>
  path.replace(/(^|\/)\([^/]+\)(?=\/|$)/g, "").replace(/^\//, "");
