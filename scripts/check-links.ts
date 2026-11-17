// Every internal link, download and image in the built site points at a file
// that exists, every link to a section of a page lands on its anchor, and
// every documentation link the editor shows lands on its page and anchor.
// Every redirect lands on a built page and anchor, and no redirect starts
// from a page that is still built. Every page URL built before the
// areas came in is still built or redirects, and each area's sidebar lists
// only its pages. A link to a guide's old URL, which forwards its #section to
// the reader's platform version, lands when some platform version has it.
// Every page opens with a skip link to an element it has, every table and
// code block scrolls in a named frame, and the Fumadocs markup the keyboard
// fixes rely on is there. Nothing built or downloadable holds a regional name
// the public repositories leave out.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { docsLinks } from "@ingestron/authoring";
import { join, relative } from "node:path";
import { unzipSync } from "fflate";
import { baseOptions } from "../lib/layout.shared";
import { catalogueToc } from "../lib/connector-page";
import { connectorEntries, connectorIds, connectorsFor } from "../lib/reference";
import {
  allowedOn,
  leakWords,
  movedPages,
  pageName,
  platforms,
  sharedPages,
  type Platform,
} from "../lib/platforms";
import { patterns, redirectFor, redirects } from "../worker/redirects.js";

const out = join(process.cwd(), "out");
const broken = new Set<string>();
for (const page of htmlFiles(out)) {
  for (const [, href] of readFileSync(page, "utf8").matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    if (!href!.startsWith("/_next/") && !exists(href!))
      broken.add(`${page.slice(out.length)} → ${href}`);
  }
}
// Every link to a section of a page, on another page or the same one, lands
// on an id that page has: a heading, or an old anchor a moved section keeps
// (components/old-anchor.tsx).
let sections = 0;
for (const page of htmlFiles(out)) {
  const html = readFileSync(page, "utf8");
  for (const [, href] of html.matchAll(/href="(\/docs[^"#?]*#[^"]+)"/g)) {
    sections++;
    problem(href!, `link on ${pagePath(page)}`);
  }
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) {
    sections++;
    if (!hasId(html, anchor!)) broken.add(`link on ${pagePath(page)} → #${anchor} (no anchor)`);
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
// No URL is lost: test/page-urls.txt lists the pages main built before the
// areas; each is built, or redirects to a built page.
const urls = readFileSync(join(process.cwd(), "test/page-urls.txt"), "utf8").trim().split("\n");
for (const url of urls)
  problem(
    redirectFor(new URL(url, "https://docs.ingestron.io")) ?? url,
    "page built before the areas",
  );
// The home page's cards and ways in link to built pages and anchors.
for (const [, href] of readFileSync(join(out, "docs.html"), "utf8").matchAll(
  /href="(\/docs[^"]*#[^"]+)"/g,
))
  problem(href!, "home page link");
sidebars();
const framed = keyboard();
fumadocsMarkup();
const scanned = noRegionalNames();
const pure = onlyTheirPlatforms();

if (broken.size > 0) {
  console.log(`✗ ${broken.size} broken links:\n${[...broken].join("\n")}`);
  process.exit(1);
}
console.log(
  `✓ every internal link resolves, ${sections} links to a section land on it, all ${editorLinks.length} editor links land, all ${urls.length} pages built before the areas are built or redirect, each sidebar lists only its area, every page has a skip link, ${framed} named frames and the markup the keyboard fixes use, none of ${scanned} built and downloadable files holds a regional name, and each of ${pure} site pages names only the platforms its site is for`,
);

/**
 * Each area's sidebar, as built. Every page but the home page has one; it
 * lists the page (a connector page, the catalogue), no page is in two areas'
 * sidebars, and no sidebar lists a connector: the Connectors sidebar holds
 * the catalogue and a link to each category on it. The header's links, which
 * the phone menu repeats above the pages, are left out.
 */
function sidebars(): void {
  const moved = new Set([
    ...Object.keys(movedPages).map((old) => `/docs/${old}`),
    "/docs/connectors",
    ...connectorIds().map((id) => `/docs/connectors/${id}`),
  ]);
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
    // The section's group above the tree (components/section-companion.tsx)
    // links the section's other half, so it is left out here.
    const aside = html
      .slice(start, html.indexOf("</aside>", start))
      .replace(/<nav class="section-companion"[\s\S]*?<\/nav>/, "");
    const links = [...aside.matchAll(/href="([^"]+)"/g)]
      .map((match) => match[1]!)
      .filter(
        (href, index) => href.startsWith("/") && !(index < menu.length && href === menu[index]),
      );
    if (!moved.has(path)) found++;
    const connectorPage = /^\/docs\/([a-z]+)\/connectors\/[^/#]+$/;
    for (const href of links)
      if (connectorPage.test(href)) broken.add(`sidebar of ${path} lists ${href}`);
    // A guide's old URL is in no area, and its sidebar lists nothing.
    if (moved.has(path)) {
      if (links.length > 0) broken.add(`sidebar of ${path} lists ${links.join(" ")}`);
      found++;
      continue;
    }
    // A connector page's sidebar is its platform's catalogue and categories.
    const platform = /^\/docs\/([a-z]+)\/connectors(?:\/|$)/.exec(path)?.[1] as
      Platform["id"] | undefined;
    const own = platform ? `/docs/${platform}/connectors` : path;
    if (!links.includes(own)) broken.add(`sidebar of ${path} does not list ${own}`);
    if (platform) {
      const expected = [own, ...catalogueToc([], platform).map((item) => `${own}${item.url}`)];
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
  const built = pages.length;
  if (found !== built) broken.add(`${found} sidebars for ${built} pages`);
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

/**
 * The Fumadocs 16.17.8 markup components/keyboard.tsx and app/keyboard.css
 * work on, on every page with the areas' layout: the header and its menu
 * button, the tab bar, the "On this page" bar, and each heading's anchor
 * button as a direct child of the heading, after its link.
 */
function fumadocsMarkup(): void {
  for (const file of htmlFiles(join(out, "docs"))) {
    const path = pagePath(file);
    const html = readFileSync(file, "utf8");
    const header = /<header id="nd-subnav"[\s\S]*?<\/header>/.exec(html)?.[0];
    if (!header) broken.add(`${path}: no <header id="nd-subnav">`);
    else {
      if (!/<button [^>]*aria-controls="nd-sidebar-mobile"/.test(header))
        broken.add(`${path}: no menu button for #nd-sidebar-mobile in the header`);
      if (!/data-header-tabs/.test(header))
        broken.add(`${path}: no [data-header-tabs] in the header`);
      // The platform picker: named for the page's platform, or "Choose a platform"
      // until the browser knows the reader's; and the platforms' tabs, marked.
      const platform = platforms.find(
        (item) => path === `/docs/${item.id}` || path.startsWith(`/docs/${item.id}/`),
      );
      const named = platform ? `Platform: ${platform.title}` : "Choose a platform";
      if (!header.includes(`class="platform-picker-button" aria-label="${named}"`))
        broken.add(`${path}: no platform picker named "${named}" in the header`);
      for (const item of platforms)
        if (!header.includes(`data-platform="${item.id}"`))
          broken.add(`${path}: no ${item.id} tabs in the header`);
    }
    // Fumadocs' Heading marks its headings group/heading; headings other
    // components draw, such as the error codes and the contents' title, have none.
    const headings = [
      ...html.matchAll(/<(h[2-6]) id="([^"]+)" class="group\/heading[^"]*"[^>]*>([\s\S]*?)<\/\1>/g),
    ];
    const toc = /<button [^>]*data-toc-popover-trigger/.test(html);
    if (/id="toc-title"/.test(html) && !toc)
      broken.add(`${path}: no [data-toc-popover-trigger] button`);
    if (toc && headings.length === 0) broken.add(`${path}: has contents but no Fumadocs heading`);
    for (const [, , id, inner] of headings)
      if (
        !inner!.includes(`<a data-card="" href="#${id}">`) ||
        !/<\/a><button aria-live="polite"/.test(inner!)
      )
        broken.add(`${path}: heading #${id} has no anchor button after its link`);
  }
}

/**
 * Nothing in out/ or the downloads holds a regional name the public
 * repositories leave out: a country and its time zone, built from parts so
 * that this file does not hold them either. Returns how many files it read.
 */
function noRegionalNames(): number {
  const names = [["new", "zea" + "land"].join(" "), "auck" + "land", "aro" + "ha"];
  const words = new RegExp(names.join("|"), "i");
  const decode = new TextDecoder();
  let count = 0;
  const zips = readdirSync(join(process.cwd(), "public/downloads"))
    .filter((name) => name.endsWith(".zip"))
    .map((name) => join(process.cwd(), "public/downloads", name));
  for (const file of [...allFiles(out), ...zips]) {
    if (file.endsWith(".zip")) {
      for (const [entry, bytes] of Object.entries(unzipSync(readFileSync(file)))) {
        count++;
        if (words.test(decode.decode(bytes)))
          broken.add(`${relative(process.cwd(), file)}: ${entry} holds a regional name`);
      }
      continue;
    }
    if (/\.(png|jpe?g|webp|ico|woff2?|gif)$/.test(file)) continue;
    count++;
    if (words.test(readFileSync(file, "utf8")))
      broken.add(`${relative(process.cwd(), file)} holds a regional name`);
  }
  return count;
}

/** Every file under a folder. */
function allFiles(folder: string): string[] {
  return readdirSync(folder, { recursive: true, encoding: "utf8" })
    .map((name) => join(folder, name))
    .filter((path) => statSync(path).isFile());
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
  // A connector's old URL, or the old catalogue's, lists the platforms' pages; its anchor is on them.
  const old = /^\/docs\/connectors(?:\/([^/]+))?$/.exec(path);
  if (old && anchor) {
    const connector = old[1];
    const versions = platforms
      .filter((platform) => !connector || connectorsFor(platform.id).includes(connector))
      .map((platform) =>
        join(
          out,
          "docs",
          platform.id,
          "connectors",
          connector ? `${connector}.html` : "index.html",
        ),
      )
      .map((file) => (existsSync(file) ? file : file.replace(/\/index\.html$/, ".html")));
    if (!versions.some((file) => existsSync(file) && hasId(readFileSync(file, "utf8"), anchor)))
      broken.add(`${what} → ${link} (no platform's page has the anchor)`);
    return;
  }
  const key = movedPages[path.replace(/^\/docs\//, "")];
  if (key && anchor) {
    const versions = sharedPages[key]!.platforms.map((id) =>
      join(out, "docs", id, `${pageName(key)}.html`),
    );
    if (!versions.some((file) => existsSync(file) && hasId(readFileSync(file, "utf8"), anchor)))
      broken.add(`${what} → ${link} (no platform version has the anchor)`);
    return;
  }
  const page = [`${join(out, path)}.html`, join(out, path, "index.html")].find(existsSync);
  if (!page) broken.add(`${what} → ${link} (no page)`);
  else if (anchor && !hasId(readFileSync(page, "utf8"), anchor))
    broken.add(`${what} → ${link} (no anchor)`);
}

/** Whether some element of the page has this id: `id="x"` as an attribute, not `data-id="x"`. */
function hasId(html: string, id: string): boolean {
  return new RegExp(`\\sid="${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(html);
}

/** The route a built file serves, such as /docs/start for out/docs/start.html. */
function pagePath(file: string): string {
  const route = `/${relative(out, file).replaceAll("\\", "/")}`;
  return route.replace(/\/index\.html$/, "").replace(/\.html$/, "") || "/";
}

/**
 * Where the patterns send the old connector chapter URLs: every chapter that
 * was built, one per pack that reads the connector, and its examples; and the
 * connector pages a platform lost to a combination. A
 * pattern no probe matches is a problem, so no pattern goes unchecked.
 */
function patternTargets(): string[] {
  const probes = connectorIds().flatMap((id) => [
    // A connector page a platform lost to a combination.
    ...(["databricks", "synapse", "duckdb"] as const)
      .filter((platform) => !connectorsFor(platform).includes(id))
      .map((platform) => `/docs/${platform}/connectors/${id}`),
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

/**
 * Each site's built pages name only the platforms the site is for
 * (lib/platforms.ts's allowedOn), in what the components render too: the
 * article only, since the header's picker and tabs name every site. A
 * site's pages may name the sources its connectors read, such as Azure
 * Synapse Analytics read as a source. test/platform-leak.test.ts checks the pages' text before building.
 * Returns how many pages it checked.
 */
function onlyTheirPlatforms(): number {
  // Sentences the packs and published standards write, which name another
  // platform: product findings, to remove once they change.
  const productText = [
    "Databricks lists them under Identity and access; on Synapse, it is a database user.",
    "so it pauses with the Databricks job",
  ];
  let checked = 0;
  for (const site of platforms) {
    const folder = join(out, "docs", site.id);
    if (!existsSync(folder)) continue;
    const files = [...htmlFiles(folder), `${folder}.html`].filter((file) => existsSync(file));
    for (const file of files) {
      const html = readFileSync(file, "utf8");
      const start = html.indexOf('id="nd-page"');
      if (start === -1) continue;
      const end = html.indexOf("</article>", start);
      let text = html
        .slice(start, end === -1 ? undefined : end)
        .replace(/<script[\s\S]*?<\/script>/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      // The sources the site's connectors read may be named, by title and id:
      // Azure Synapse Analytics or Databricks Delta read as a source.
      for (const id of connectorsFor(site.id)) {
        const title = connectorEntries(id)[0]!.connector.title;
        text = text.replaceAll(title, " ").replaceAll(id, " ");
      }
      text = text.replace(/\bDatabricks Delta\b/g, " ");
      for (const product of productText) text = text.replaceAll(product, " ");
      checked++;
      // A connector's own page may name the platform its source is, such as
      // the Databricks workspace that Azure Databricks Delta Lake reads from.
      const own = /\/connectors\/([a-z0-9-]+)\.html$/.exec(file)?.[1];
      const ownTitle = own ? (connectorEntries(own)[0]?.connector.title ?? "") : "";
      for (const [other, words] of Object.entries(leakWords)) {
        if (allowedOn(site.id).includes(other)) continue;
        if (ownTitle && new RegExp(words.source, "i").test(ownTitle)) continue;
        const found = text.match(words);
        if (found)
          broken.add(
            `${pagePath(file)} names ${other} ${found.length}× (${[...new Set(found)].join(", ")})`,
          );
      }
    }
  }
  return checked;
}
