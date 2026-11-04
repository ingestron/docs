// One page per connector: every connector a pack reads has a page with its
// routes, how to connect and read with each pack, settings and an example. The
// ids on a page are unique, every in-page link lands, and the old chapter URLs
// land on the page's sections.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConnectorPage } from "../components/reference/connector-page";
import {
  connectorSections,
  connectorSlots,
  connectorToc,
  noteHeadingSlots,
} from "../lib/connector-page.js";
import { connectorEntries, connectorIds } from "../lib/reference.js";
import { redirectFor } from "../worker/redirects.js";
import { openProject, referenceForDocs } from "@ingestron/authoring";
import { exampleFolder } from "../lib/examples.js";

// The code blocks render asynchronously in the site; here each shows its file's name.
vi.mock("@/components/example", () => ({
  Example: ({ name, file }: { name: string; file: string }) =>
    createElement("pre", { "data-example": `${name}/${file}` }),
}));

// The first page rendered resolves every sample, which takes seconds on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

const source = (id: string) =>
  readFileSync(join(process.cwd(), "content/docs/connectors", `${id}.mdx`), "utf8");
const page = (id: string) => renderToStaticMarkup(createElement(ConnectorPage, { id }));
const ids = (html: string) => [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]!);
/** The custom ids of the notes' headings, written `### Title [#id]`. */
const noteIds = (text: string) =>
  [...text.matchAll(/^#{1,6} .*\[#([^\]]+)\]$/gm)].map((match) => match[1]!);
/** The text between one section's heading and the next section's. */
const section = (html: string, id: string) => {
  const start = html.indexOf(`<h2 id="${id}"`);
  const next = html.indexOf("<h2 ", start + 1);
  return html.slice(start, next === -1 ? undefined : next);
};

describe("connector pages", () => {
  it("give every connector any pack reads a page, with settings for each pack and an example", () => {
    for (const id of connectorIds()) {
      expect(existsSync(join(process.cwd(), "content/docs/connectors", `${id}.mdx`)), id).toBe(
        true,
      );
      const html = page(id);
      expect(html, id).toContain('<h2 id="routes"');
      expect(html, id).toContain('<h2 id="examples"');
      expect(section(html, "examples"), `${id}: a download`).toContain("example-download");
      for (const { pack, connector } of connectorEntries(id)) {
        const connect = section(html, `${pack}-connection`);
        const read = section(html, `${pack}-ingestion`);
        expect(connect, `${id}: connect with ${pack}`).not.toBe("");
        for (const setting of connector.settings)
          expect(connect, `${id}: ${pack} field ${setting.name}`).toContain(
            `id="${pack}-connection-${setting.name}"`,
          );
        expect(connect, `${id}: ${pack} example connection`).toContain("data-example=");
        expect(read, `${id}: ${pack} example flow`).toMatch(/data-example="[^"]+\/flows\//);
        expect(read, `${id}: ${pack} reading settings`).toContain(`id="${pack}-settings"`);
        expect(read, `${id}: ${pack} settings`).toMatch(
          /<section id="[^"]+"><header class="setting-heading"><h4>/,
        );
      }
    }
    // Renders all 77 pages and reads their samples.
  }, 30_000);

  it("keep ids unique and land every in-page link, notes included", () => {
    for (const id of connectorIds()) {
      const html = page(id);
      const text = source(id);
      const all = [...ids(html), ...noteIds(text)];
      expect(
        all.filter((item, index) => all.indexOf(item) !== index),
        id,
      ).toEqual([]);
      const links = [
        ...[...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]!),
        ...[...text.matchAll(/\]\(#([^)]+)\)/g)].map((match) => match[1]!),
      ];
      for (const link of links) expect(all, `${id}: #${link}`).toContain(link);
      // The editor's Reference view links each connector's settings here.
      expect(
        ids(html).filter((item) => item === "settings"),
        id,
      ).toHaveLength(1);
    }
  }, 30_000);

  it("put #settings on the fields of the pack whose settings the editor's Reference view lists", () => {
    const project = openProject(exampleFolder("minimal"), new Map());
    for (const id of connectorIds()) {
      const entry = referenceForDocs(project, `/docs/connectors/${id}`, "dev");
      const [first] = connectorEntries(id);
      // The editor lists the first pack's settings, each linked to #settings.
      expect(
        entry?.fields?.map((field) => field.name),
        id,
      ).toEqual(first!.connector.settings.map((setting) => setting.name));
      for (const field of entry?.fields ?? [])
        expect(field.docs, id).toBe(`/docs/connectors/${id}#settings`);
      // The page puts #settings on that same pack's connection fields.
      expect(section(page(id), `${first!.pack}-connection`), id).toContain('id="settings"');
    }
  }, 30_000);

  it("hold SQL Server's two packs on one page, each with its own anchors", () => {
    const html = page("sqlserver");
    const found = ids(html);
    expect(found).toContain("adf-connection");
    expect(found).toContain("databricks-connection");
    expect(found).toContain("adf-ingestion");
    expect(found).toContain("databricks-ingestion");
    expect(found).toContain("databricks-connection-uc_connection");
    expect(found).toContain("adf-connection-host_name_in_certificate");
    expect(found).not.toContain("connection-server");
    expect(new Set(found).size).toBe(found.length);
    // Databricks comes first, as the packs are listed, so the editor's #settings opens its fields.
    expect(html.indexOf('id="settings"')).toBeGreaterThan(
      html.indexOf('id="databricks-connection"'),
    );
    expect(html.indexOf('id="settings"')).toBeLessThan(html.indexOf('id="adf-connection"'));
  });

  it("place each note in a slot its page has; headed notes have ids and sit between parts", () => {
    for (const id of connectorIds()) {
      const text = source(id);
      expect(text, id).toMatch(new RegExp(`<ConnectorPage id="${id}"( /)?>`));
      const slots = connectorSlots(id);
      for (const [, at] of text.matchAll(/<ConnectorNote at="([^"]+)">/g))
        expect(slots, `${id}: slot ${at}`).toContain(at);
      const headed = noteHeadingSlots(id);
      expect(noteIds(text), `${id}: every note heading has an id`).toHaveLength(headed.length);
      // A note in a part's slot continues that part, so it has no heading of its own.
      const inParts = connectorSections(id).flatMap((section) =>
        section.items.flatMap((item) => ("part" in item && item.part.slot ? [item.part.slot] : [])),
      );
      for (const slot of headed) expect(inParts, `${id}: heading in ${slot}`).not.toContain(slot);
    }
  });

  it("list the notes' headings in the contents where the notes are", () => {
    const notes = noteIds(source("sqlserver")).map((id) => ({
      title: id,
      url: `#${id}`,
      depth: 3,
    }));
    const toc = connectorToc("sqlserver", notes).map((item) => item.url);
    const at = (url: string) => toc.indexOf(url);
    expect(at("#adf-authentication")).toBeGreaterThan(at("#adf-encryption"));
    expect(at("#adf-authentication")).toBeLessThan(at("#adf-fields"));
    expect(toc.slice(0, 2)).toEqual(["#routes", "#databricks-connection"]);
    expect(toc.at(-1)).toBe("#examples");
    expect(() => connectorToc("sqlserver", [])).toThrow("headings");
  });

  it("send every old chapter URL to its section on the page", () => {
    for (const id of connectorIds()) {
      const found = ids(page(id));
      const chapters = [
        "examples",
        ...connectorEntries(id).flatMap(({ pack }) => [`${pack}-connection`, `${pack}-ingestion`]),
      ];
      for (const chapter of chapters) {
        const target = redirectFor(
          new URL(`https://docs.ingestron.io/docs/connectors/${id}/${chapter}`),
        );
        expect(target, `${id}/${chapter}`).toBe(`/docs/connectors/${id}#${chapter}`);
        expect(found, `${id}: #${chapter}`).toContain(chapter);
      }
      expect(existsSync(join(process.cwd(), "content/docs/connectors", id)), id).toBe(false);
    }
  }, 30_000);
});
