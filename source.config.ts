import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { codeThemes } from "./lib/code-themes";
import { rehypeBoxDrawing } from "./lib/rehype-box-drawing";
import { rehypeFrameNames } from "./lib/rehype-frame-names";

export const docs = defineDocs({ dir: "content/docs" });
export default defineConfig({
  mdxOptions: {
    // The language class tells rehypeFrameNames what each block holds.
    rehypeCodeOptions: { themes: codeThemes, addLanguageClass: true },
    // After highlighting, so they see the code block Fumadocs renders.
    rehypePlugins: (plugins) => [...plugins, rehypeBoxDrawing, rehypeFrameNames],
    remarkStructureOptions: {
      // Search the prose, not navigation component attributes.
      types: ["heading", "paragraph", "blockquote", "tableCell"],
    },
  },
});
