import type { MetadataRoute } from "next";
import { source } from "@/lib/source";
export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: `https://docs.ingestron.io${page.url}`,
    lastModified: new Date("2026-09-22"),
    changeFrequency: "weekly",
    priority: page.url === "/docs" ? 1 : 0.7,
  }));
}
