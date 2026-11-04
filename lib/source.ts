import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { areaNavigation } from "./page-tree";

export const source = loader({
  baseUrl: "/docs",
  pageTree: { transformers: [areaNavigation] },
  source: docs.toFumadocsSource(),
});
