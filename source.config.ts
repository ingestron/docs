import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { codeThemes } from "./lib/code-themes";
import { rehypeBoxDrawing } from "./lib/rehype-box-drawing";

export const docs = defineDocs({ dir: "content/docs" });
export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: { themes: codeThemes },
    // After highlighting, so it sees the code block Fumadocs renders.
    rehypePlugins: (plugins) => [...plugins, rehypeBoxDrawing],
    remarkStructureOptions: {
      // Search the prose, not navigation component attributes.
      types: ["heading", "paragraph", "blockquote", "tableCell"],
    },
  },
});
