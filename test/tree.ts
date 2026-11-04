// The site's page tree, built from content/docs the way lib/source.ts builds
// it, without the MDX compiler: each page's front matter and each meta.json.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loader, type VirtualFile } from "fumadocs-core/source";
import { parse } from "yaml";
import { areaNavigation } from "../lib/page-tree.js";

const folder = join(process.cwd(), "content/docs");
const files: VirtualFile[] = readdirSync(folder, { recursive: true, encoding: "utf8" })
  .filter((path) => path.endsWith(".mdx") || path.endsWith("meta.json"))
  .map((path) => {
    const text = readFileSync(join(folder, path), "utf8");
    return path.endsWith("meta.json")
      ? { type: "meta", path, data: JSON.parse(text) }
      : { type: "page", path, data: parse(text.split("---")[1] ?? "") };
  });

export const source = loader({
  baseUrl: "/docs",
  source: { files },
  pageTree: { transformers: [areaNavigation] },
});
export const tree = source.getPageTree();
