// The platform sites: each platform folder holds a folder per section, each a
// root folder; a section holds the pages lib/platforms.ts lists for it (the
// shared pages, as stubs, and the platform's own pages) and nothing else; a
// shared page's <Only> blocks name only platforms that show it; and each
// shared page's old URL lists its versions.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentFolder, sharedFolder } from "../lib/content-files.js";
import { onlyFor } from "../lib/platform-text.js";
import {
  movedPages,
  pageName,
  pagesFor,
  platformIds,
  platformSections,
  sectionFolder,
  sectionsOf,
  sectionTitles,
  sharedPageNamed,
  sharedPages,
} from "../lib/platforms.js";
import { hereOn, remarkOnly } from "../lib/remark-only.js";

/** The shared files, as `guides/write-a-contract`; connector files are Task 4's. */
const shared = readdirSync(sharedFolder, { recursive: true, encoding: "utf8" })
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => file.endsWith(".mdx") && !file.startsWith("connectors/"))
  .map((file) => file.replace(/\.mdx$/, ""));

const json = (file: string) => JSON.parse(readFileSync(file, "utf8"));

describe("the platform sites", () => {
  it("share exactly the pages lib/platforms.ts lists, each written once, each name used once", () => {
    expect([...shared].sort()).toEqual(Object.keys(sharedPages).sort());
    const names = Object.keys(sharedPages).map(pageName);
    expect(new Set(names).size).toBe(names.length);
    for (const key of Object.keys(sharedPages)) expect(sharedPageNamed(pageName(key))).toBe(key);
    for (const [key, page] of Object.entries(sharedPages))
      expect(key.startsWith(`${page.section}/`), key).toBe(true);
  });

  it.each(platformIds)("%s holds one root folder per section, in order", (id) => {
    const folder = join(contentFolder, id);
    const meta = json(join(folder, "meta.json"));
    expect(meta.root, id).toBeUndefined();
    expect(meta.pages).toEqual(sectionsOf(id).map(sectionFolder));
    expect(sectionsOf(id)).toEqual(platformSections.filter((s) => sectionsOf(id).includes(s)));
    // Nothing but the section folders and the platform's meta.json.
    expect(readdirSync(folder).sort()).toEqual(
      ["meta.json", ...sectionsOf(id).map(sectionFolder)].sort(),
    );
    for (const section of sectionsOf(id)) {
      const sectionMeta = json(join(folder, sectionFolder(section), "meta.json"));
      expect(sectionMeta.root, `${id}/${section}`).toBe(true);
      expect(sectionMeta.title, `${id}/${section}`).toBe(sectionTitles[section]);
      expect(String(sectionMeta.description ?? ""), `${id}/${section}`).toMatch(/\.$/);
    }
  });

  it.each(platformIds)("%s's sections hold exactly their pages, shared ones as stubs", (id) => {
    for (const section of sectionsOf(id)) {
      if (section === "connectors") continue;
      const folder = join(contentFolder, id, sectionFolder(section));
      const files = readdirSync(folder)
        .filter((file) => file.endsWith(".mdx"))
        .map((file) => file.replace(/\.mdx$/, ""));
      expect([...files].sort(), `${id}/${section}`).toEqual([...pagesFor(id, section)].sort());
      const meta = json(join(folder, "meta.json"));
      const listed = (meta.pages as string[]).filter((page) => !page.startsWith("---"));
      expect([...listed].sort(), `${id}/${section} meta`).toEqual([...files].sort());
      if (section === "start") expect(listed[0]).toBe("index");
      for (const file of files) {
        const key = sharedPageNamed(file);
        if (!key) continue;
        const text = readFileSync(join(folder, `${file}.mdx`), "utf8");
        expect(text, `${id}/${file}`).toMatch(/^---\ntitle: .+\ndescription: .+\n---\n/);
        expect(text.trim().endsWith(`<include>../../../shared/${key}.mdx</include>`), file).toBe(
          true,
        );
      }
    }
  });

  it.each(Object.keys(sharedPages))("%s keeps <Only> to the platforms that show it", (key) => {
    const text = readFileSync(join(sharedFolder, `${key}.mdx`), "utf8");
    const page = sharedPages[key]!;
    for (const [, on] of text.matchAll(/<Only on="([^"]*)">/g))
      for (const id of on!.split(/\s+/))
        expect(page.platforms, `${key}: <Only on="${on}">`).toContain(id);
    for (const id of page.platforms) {
      const shown = onlyFor(text, id, key);
      expect(shown, `${key} on ${id}`).not.toContain("<Only");
      expect(shown, `${key} on ${id}`).not.toContain("</Only>");
      expect(shown, `${key} on ${id}`).not.toContain("/docs/~/");
      // A link to another platform's copy of a shared page is a slip: it would leave the site.
      for (const other of platformIds.filter((other) => other !== id))
        for (const [, name] of shown.matchAll(new RegExp(`\\(/docs/${other}/([a-z-]+)`, "g")))
          expect(sharedPageNamed(name!), `${key} on ${id} links ${other}/${name}`).toBeUndefined();
    }
  });

  it("send a link to a page a platform lacks to the page's old URL", () => {
    expect(hereOn("/docs/~/grant-access#roles", "duckdb")).toBe("/docs/how-to/grant-access#roles");
    expect(hereOn("/docs/~/grant-access#roles", "synapse")).toBe(
      "/docs/synapse/grant-access#roles",
    );
    expect(hereOn("/docs/~/create-a-project", "adf")).toBe("/docs/adf/create-a-project");
    expect(hereOn("/docs/~/load-with-adf", "adf-duckdb")).toBe("/docs/adf-duckdb/load-with-adf");
    // A site that loads no source has no catalogue: the list of every source.
    expect(hereOn("/docs/~/connectors", "duckdb")).toBe("/docs/connectors");
    expect(hereOn("/docs/~/connectors#files", "duckdb")).toBe("/docs/connectors#files");
    expect(hereOn("/docs/~/configure-a-standard#rules", "adf")).toBe(
      "/docs/adf/configure-a-standard#rules",
    );
  });

  it("keep each shared page's old URL as a page that lists its versions", () => {
    for (const [old, key] of Object.entries(movedPages)) {
      const file = join(contentFolder, "(moved)", `${old}.mdx`);
      expect(existsSync(file), old).toBe(true);
      expect(readFileSync(file, "utf8"), old).toContain(`<PlatformChooser page="${key}" />`);
    }
    expect([...new Set(Object.values(movedPages))].sort()).toEqual(Object.keys(sharedPages).sort());
    expect(movedPages["how-to/start-from-a-template"]).toBe("guides/create-a-project");
    expect(movedPages["start/first-project"]).toBe("start/first-project");
    expect(movedPages["how-to/configure-a-standard"]).toBe("standards/configure-a-standard");
  });
});

describe("an example named for the page's platform", () => {
  it("turns a name ending in -~ into that platform's example", () => {
    const example = {
      type: "mdxJsxFlowElement",
      name: "Example",
      attributes: [{ type: "mdxJsxAttribute", name: "name", value: "data-products-~" }],
      children: [],
    };
    const tree = { type: "root", children: [example] };
    remarkOnly()(tree, { path: join(contentFolder, "synapse/(guides)/define-a-data-product.mdx") });
    expect(example.attributes[0]!.value).toBe("data-products-synapse");
  });
});
