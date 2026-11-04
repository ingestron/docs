// Every internal link, download and image in the built site points at a file
// that exists, and every documentation link the editor shows lands on its page
// and anchor. Every redirect lands on a built page and anchor, and no redirect
// starts from a page that is still built.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { docsLinks } from "@ingestron/authoring";
import { join, relative } from "node:path";
import { connectorEntries, connectorIds } from "../lib/reference";
import { patterns, redirectFor, redirects } from "../worker/redirects.js";

const out = join(process.cwd(), "out");
const broken = new Set<string>();
for (const page of htmlFiles(out)) {
  for (const [, href] of readFileSync(page, "utf8").matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    if (!href!.startsWith("/_next/") && !exists(href!))
      broken.add(`${page.slice(out.length)} → ${href}`);
  }
}
// The editor links each connector's page, and its Reference view links the
// page's settings (authoring's connectorEntry).
const editorLinks = [
  ...new Set([
    ...docsLinks(),
    ...connectorIds().flatMap((id) => [
      `/docs/connectors/${id}`,
      `/docs/connectors/${id}#settings`,
    ]),
  ]),
];
for (const link of editorLinks) problem(link, "editor link");

for (const target of new Set(redirects.values())) problem(target, "redirect target");
for (const target of patternTargets()) problem(target, "redirect target");
for (const page of htmlFiles(out)) {
  const path = pagePath(page);
  const target = redirectFor(new URL(path, "https://docs.ingestron.io"));
  if (target !== undefined) broken.add(`redirect source ${path} is still a built page → ${target}`);
}
if (broken.size > 0) {
  console.log(`✗ ${broken.size} broken links:\n${[...broken].join("\n")}`);
  process.exit(1);
}
console.log(`✓ every internal link resolves, and all ${editorLinks.length} editor links land`);

function exists(href: string): boolean {
  const path = join(out, href);
  return [path, `${path}.html`, join(path, "index.html")].some(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
}

function htmlFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((entry) => {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return path.endsWith(".html") ? [path] : [];
  });
}

/** Adds a problem unless the link's page, and its anchor if it has one, are built. */
function problem(link: string, what: string): void {
  const [path = "", anchor] = link.split("#");
  const page = [`${join(out, path)}.html`, join(out, path, "index.html")].find(existsSync);
  if (!page) broken.add(`${what} → ${link} (no page)`);
  else if (anchor && !readFileSync(page, "utf8").includes(`id="${anchor}"`))
    broken.add(`${what} → ${link} (no anchor)`);
}

/** The route a built file serves, such as /docs/start for out/docs/start.html. */
function pagePath(file: string): string {
  const route = `/${relative(out, file).replaceAll("\\", "/")}`;
  return route.replace(/\/index\.html$/, "").replace(/\.html$/, "") || "/";
}

/**
 * Where the patterns send the old connector chapter URLs: every chapter that
 * was built, one per pack that reads the connector, and its examples. A
 * pattern no probe matches is a problem, so no pattern goes unchecked.
 */
function patternTargets(): string[] {
  const probes = connectorIds().flatMap((id) => [
    `/docs/connectors/${id}/examples`,
    ...connectorEntries(id).flatMap(({ pack }) => [
      `/docs/connectors/${id}/${pack}-connection`,
      `/docs/connectors/${id}/${pack}-ingestion`,
    ]),
  ]);
  for (const [pattern] of patterns)
    if (!probes.some((probe) => pattern.test(probe)))
      broken.add(`redirect pattern ${pattern} has no probe, so its targets go unchecked`);
  return probes.map((path) => {
    const target = redirectFor(new URL(path, "https://docs.ingestron.io"));
    if (target === undefined) broken.add(`old chapter ${path} does not redirect`);
    return target ?? path;
  });
}
