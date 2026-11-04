import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { projectSources } from "@ingestron/cli";
import { loader, type VirtualFile } from "fumadocs-core/source";
import { findPath, getPageTreeRoots } from "fumadocs-core/page-tree";
import { expect, it } from "vitest";
import { connectionNavigation } from "../lib/connection-navigation.js";
import { categoryAnchor } from "../lib/connector-page.js";
import { connectorEntries, connectorIds } from "../lib/reference.js";

const folder = join(process.cwd(), "content/docs");
const files: VirtualFile[] = readdirSync(folder, { recursive: true, encoding: "utf8" })
  .filter((path) => path.endsWith(".mdx") || path.endsWith("meta.json"))
  .map((path) => {
    const text = readFileSync(join(folder, path), "utf8");
    return path.endsWith("meta.json")
      ? { type: "meta", path, data: JSON.parse(text) }
      : { type: "page", path, data: parse(text.split("---")[1] ?? "") };
  });
const source = loader({
  baseUrl: "/docs",
  source: { files },
  pageTree: { transformers: [connectionNavigation] },
});
const tree = source.getPageTree();
const pathTo = (url: string) =>
  findPath(tree.children, (node) => node.type === "page" && node.url === url, {
    includeSeparator: false,
  });

it("keeps connector pages and shared guides under the same global root", () => {
  expect(getPageTreeRoots(tree)).toHaveLength(1);
  expect(pathTo("/docs/connectors/sqlserver")?.map((node) => node.name)).toEqual([
    "Connections",
    "Databases and analytics",
    "SQL Server",
  ]);
  // The shared ADF setup page sits in the same root, in the Platforms group.
  expect(pathTo("/docs/platforms/adf")?.map((node) => node.name)).toEqual(["Azure Data Factory"]);
  const group = tree.children.findIndex(
    (node) => node.type === "separator" && node.name === "Platforms",
  );
  const next = tree.children.findIndex((node, index) => index > group && node.type === "separator");
  const adf = tree.children.findIndex(
    (node) => node.type === "page" && node.url === "/docs/platforms/adf",
  );
  expect(group, "a Platforms separator").toBeGreaterThan(-1);
  expect(adf).toBeGreaterThan(group);
  expect(adf).toBeLessThan(next);
});

it("keeps every connector reachable at its existing URL, as one page with no chapters", () => {
  for (const id of connectorIds()) {
    const path = pathTo(`/docs/connectors/${id}`);
    expect(path, id).not.toBeNull();
    expect(path?.at(-1)?.type, id).toBe("page");
    expect(path?.filter((node) => node.type === "folder" && node.defaultOpen)).toEqual([]);
    for (const { pack } of connectorEntries(id))
      for (const chapter of ["connection", "ingestion"])
        expect(
          pathTo(`/docs/connectors/${id}/${pack}-${chapter}`),
          `${id}/${pack}-${chapter}`,
        ).toBeNull();
    expect(pathTo(`/docs/connectors/${id}/examples`), `${id}/examples`).toBeNull();
  }
});

it("opens the catalogue from its folder label, and groups connectors by category without category pages", () => {
  const path = pathTo("/docs/connectors/sqlserver")!;
  const folders = path.filter((node) => node.type === "folder");
  expect(folders.map((node) => node.index?.url)).toEqual(["/docs/connectors", undefined]);
  const catalogue = folders[0]!;
  const groups = catalogue.type === "folder" ? catalogue.children : [];
  expect(
    groups.every((node) => node.type === "folder"),
    "only category groups",
  ).toBe(true);
  expect(groups.map((node) => String(node.name)).sort()).toEqual(
    [...new Set(projectSources().map((source) => source.category))].sort(),
  );
  for (const category of groups.map((node) => node.name))
    expect(source.getPage(["connectors", categoryAnchor(String(category))])).toBeUndefined();
});

it("lists each connector in the category used by the project builder", () => {
  for (const connector of projectSources()) {
    const path = pathTo(`/docs/connectors/${connector.id}`)!;
    expect(path[1]?.name, connector.id).toBe(connector.category);
  }
});

it("lists Get started's pages under its separator, in reading order, with no index page", () => {
  const at = tree.children.findIndex(
    (node) => node.type === "separator" && node.name === "Get started",
  );
  expect(at, "a Get started separator").toBeGreaterThan(-1);
  expect(
    tree.children
      .slice(at + 1, at + 5)
      .map((node) => (node.type === "page" ? node.url : node.type)),
  ).toEqual([
    "/docs/start/first-project",
    "/docs/start/how-it-works",
    "/docs/start/choose-a-route",
    "/docs/start/install",
  ]);
  expect(tree.children[at + 5]?.type).toBe("separator");
  expect(source.getPage(["start"])).toBeUndefined();
});

it("lists the guides and concepts under their sections' separators, in order, with no index page", () => {
  const under = (name: string) => {
    const at = tree.children.findIndex((node) => node.type === "separator" && node.name === name);
    expect(at, `a ${name} separator`).toBeGreaterThan(-1);
    const next = tree.children.findIndex((node, index) => index > at && node.type === "separator");
    return tree.children
      .slice(at + 1, next)
      .map((node) => (node.type === "page" ? node.url : node.type));
  };
  expect(under("Build a project")).toEqual([
    "/docs/how-to/start-from-a-template",
    "/docs/how-to/add-a-source",
    "/docs/how-to/write-a-contract",
    "/docs/how-to/write-a-transform",
    "/docs/how-to/keep-a-table-current",
    "/docs/how-to/add-quality-checks",
    "/docs/how-to/define-a-data-product",
    "/docs/how-to/add-an-environment",
    "/docs/how-to/plan-and-generate",
    "/docs/how-to/check-in-ci",
  ]);
  expect(under("Standards and teams")).toEqual([
    "/docs/how-to/configure-a-standard",
    "/docs/how-to/name-things-your-way",
    "/docs/how-to/ask-the-platform-team",
    "/docs/how-to/share-a-template",
    "/docs/how-to/upgrade",
  ]);
  expect(under("Understand")).toEqual([
    "/docs/concepts/definitions",
    "/docs/concepts/standards-and-packs",
    "/docs/concepts/settings",
    "/docs/concepts/layers",
    "/docs/concepts/environments-and-platform",
    "/docs/concepts/yaml-references",
    "/docs/concepts/generated-files",
  ]);
  // In the design's order: the guides come before Platforms, and Understand after it.
  const order = tree.children.filter((node) => node.type === "separator").map((node) => node.name);
  expect(order.slice(0, 5)).toEqual([
    "Get started",
    "Build a project",
    "Standards and teams",
    "Platforms",
    "Understand",
  ]);
  for (const name of ["concepts", "how-to"]) expect(source.getPage([name]), name).toBeUndefined();
});

it("lists Look up after Understand: the catalogue, each reference page, VS Code and troubleshooting, with no section index pages", () => {
  const order = tree.children.filter((node) => node.type === "separator").map((node) => node.name);
  expect(order[5]).toBe("Look up");
  const at = tree.children.findIndex(
    (node) => node.type === "separator" && node.name === "Look up",
  );
  expect(
    tree.children
      .slice(at + 1)
      .map((node) =>
        node.type === "page"
          ? node.url
          : node.type === "folder"
            ? (node.index?.url ?? "")
            : node.type,
      ),
  ).toEqual([
    "/docs/connectors",
    "/docs/reference/documents",
    "/docs/reference/packs",
    "/docs/reference/errors",
    "/docs/reference/cli",
    "/docs/reference/templates",
    "/docs/reference/versions",
    "/docs/tools/vscode",
    "/docs/troubleshooting",
  ]);
  // The folders that remain open their landing page from their label, with no duplicate item.
  for (const url of ["/docs/connectors", "/docs/reference/packs"]) {
    const folder = tree.children.find((node) => node.type === "folder" && node.index?.url === url);
    expect(folder?.type, url).toBe("folder");
    if (folder?.type === "folder")
      expect(folder.children.some((child) => child.type === "page" && child.url === url)).toBe(
        false,
      );
  }
  for (const name of ["examples", "reference", "tools"])
    expect(source.getPage([name]), name).toBeUndefined();
});
