// Tests render the site's components, which import through the `@/` paths in tsconfig.json.
import { defineConfig } from "vitest/config";

export default defineConfig({ resolve: { tsconfigPaths: true } });
