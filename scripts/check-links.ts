// Every internal link, download and image in the built site points at a file
// that exists, and every documentation link the editor shows lands on its page
// and anchor. Every redirect lands on a built page and anchor, and no redirect
// starts from a page that is still built. Every page URL built before the
// areas came in is still built, and each area's sidebar lists only its pages.
// Every page opens with a skip link to an element it has, and every table and
// code block scrolls in a named frame.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { docsLinks } from "@ingestron/authoring";
import { join, relative } from "node:path";
import { baseOptions } from "../lib/layout.shared";
import { categoryAnchor, sourceCategories } from "../lib/connector-page";
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
// No URL moved: test/page-urls.txt lists the pages main built before the areas.
const urls = readFileSync(join(process.cwd(), "test/page-urls.txt"), "utf8").trim().split("\n");
for (const url of urls) problem(url, "page built before the areas");
// The home page's cards and ways in link to built pages and anchors.
for (const [, href] of readFileSync(join(out, "docs.html"), "utf8").matchAll(
  /href="(\/docs[^"]*#[^"]+)"/g,
))
  problem(href!, "home page link");
sidebars();
const framed = keyboard();

if (broken.size > 0) {
  console.log(`✗ ${broken.size} broken links:\n${[...broken].join("\n")}`);
  process.exit(1);
}
console.log(
  `✓ every internal link resolves, all ${editorLinks.length} editor links land, all ${urls.length} pages built before the areas are built, each sidebar lists only its area, and every page has a skip link and ${framed} named frames`,
);

/**
 * Each area's sidebar, as built. Every page but the home page has one; it
 * lists the page (a connector page, the catalogue), no page is in two areas'
 * sidebars, and no sidebar lists a connector: the Connectors sidebar holds
 * the catalogue and a link to each category on it. The header's links, which
 * the phone menu repeats above the pages, are left out.
 */
function sidebars(): void {
  const options = baseOptions();
  // The menu's links come first, before the area's pages.
  const menu = (options.links ?? []).map((link) => ("url" in link ? link.url : ""));
  const owner = new Map<string, string>();
  const pages = htmlFiles(join(out, "docs"));
  let found = 0;
  for (const file of pages) {
    const path = pagePath(file);
    const html = readFileSync(file, "utf8");
    const start = html.indexOf('id="nd-sidebar"');
    if (start === -1) {
      broken.add(`${path} has no sidebar`);
      continue;
    }
    found++;
    const links = [
      ...html.slice(start, html.indexOf("</aside>", start)).matchAll(/href="([^"]+)"/g),
    ]
      .map((match) => match[1]!)
      .filter(
        (href, index) => href.startsWith("/") && !(index < menu.length && href === menu[index]),
      );
    for (const href of links)
      if (href.startsWith("/docs/connectors/")) broken.add(`sidebar of ${path} lists ${href}`);
    const own = path.startsWith("/docs/connectors/") ? "/docs/connectors" : path;
    if (!links.includes(own)) broken.add(`sidebar of ${path} does not list ${own}`);
    if (own === "/docs/connectors") {
      const expected = [
        "/docs/connectors",
        ...sourceCategories().map((name) => `/docs/connectors#${categoryAnchor(name)}`),
      ];
      if (links.join(" ") !== expected.join(" "))
        broken.add(
          `sidebar of ${path} is ${links.join(" ")}, not the catalogue and its categories`,
        );
    }
    // An area's sidebar starts with its first page; a folder lists its pages only when open.
    const area = links[0]!;
    for (const href of links) {
      const first = owner.get(href);
      if (first === undefined) owner.set(href, area);
      else if (first !== area)
        broken.add(`${href} is in the sidebars of ${first} and ${area} (on ${path})`);
    }
  }
  // out/docs holds every page but the home page, which is out/docs.html.
  if (found !== urls.length - 1) broken.add(`${found} sidebars for ${urls.length - 1} area pages`);
}

/**
 * On every page: the first link is "Skip to content", to an id on the page
 * that takes focus; every table is in a named, focusable frame; and every
 * code block's scrolling frame is named. Returns how many frames it checked.
 */
function keyboard(): number {
  let frames = 0;
  for (const file of htmlFiles(join(out, "docs")).concat(join(out, "docs.html"))) {
    const path = pagePath(file);
    const html = readFileSync(file, "utf8");
    const body = html.slice(html.indexOf("<body"));
    const first = /<a [^>]*>/.exec(body)?.[0] ?? "";
    const target = /class="skip-link" href="#([^"]+)"/.exec(first)?.[1];
    if (!target) broken.add(`${path}: the first link is not the skip link (${first})`);
    else if (!new RegExp(`<[a-z]+ [^>]*id="${target}"[^>]*tabindex="-1"`).test(html))
      broken.add(`${path}: no focusable #${target} for the skip link`);
    for (const [, before] of html.matchAll(/(<div [^>]*>)\s*<table/g)) {
      frames++;
      if (
        !/role="region"/.test(before!) ||
        !/aria-label="[^"]+"/.test(before!) ||
        !/tabindex="0"/.test(before!)
      )
        broken.add(`${path}: a table outside a named frame (${before})`);
    }
    const tables = (html.match(/<table/g) ?? []).length;
    const inFrames = (html.match(/<div [^>]*>\s*<table/g) ?? []).length;
    if (tables !== inFrames)
      broken.add(`${path}: ${tables - inFrames} tables not directly in a frame`);
    for (const [region] of html.matchAll(/<div [^>]*fd-scroll-container[^>]*>/g)) {
      frames++;
      if (!/aria-label="[^"]+"/.test(region)) broken.add(`${path}: an unnamed code frame`);
    }
  }
  return frames;
}

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
