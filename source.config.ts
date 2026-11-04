import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { codeThemes } from "./lib/code-themes";

export const docs = defineDocs({ dir: "content/docs" });
export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: { themes: codeThemes },
    remarkStructureOptions: {
      // Search the prose, not navigation component attributes.
      types: ["heading", "paragraph", "blockquote", "tableCell"],
    },
  },
});
