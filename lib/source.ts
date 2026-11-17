import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { areaNavigation } from "./page-tree";

export const source = loader({
  baseUrl: "/docs",
  pageTree: { transformers: [areaNavigation] },
  source: docs.toFumadocsSource(),
});

/** Whether a page is a shared page's old URL, which links to its platform versions: `(moved)/how-to/<guide>.mdx`. */
export const movedGuide = (path: string) => path.replaceAll("\\", "/").includes("(moved)/");
