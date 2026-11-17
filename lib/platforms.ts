// The docs' platform paths. A reader chooses a platform once and then reads
// one path for it: /docs/<platform>/<page>. A guide several platforms share is
// written once in content/shared/<guide>.mdx and included by a short page in
// each platform folder that lists it here; lib/remark-only.ts keeps only that
// platform's <Only> blocks. A test fails when a folder and this list differ.

/**
 * One site of the docs: a platform, as New project's first question names it,
 * or a combination of two, listed after the platforms in the picker. A
 * platform's site names no other platform; a combination's names its two.
 */
export interface Platform {
  /** The URL folder: /docs/<id>. A combination's is its route: `adf-databricks`. */
  id: "synapse" | "databricks" | "adf" | "duckdb" | "adf-databricks" | "adf-synapse" | "adf-duckdb";
  /** A platform, or a combination of two listed under "Combined". */
  kind: "platform" | "combined";
  /** A combination's platforms, in the order the data goes through them. */
  parts?: ("synapse" | "databricks" | "adf" | "duckdb")[];
  /** `ingestron init --platform <init>`, or `--via <init>` for a combination. */
  init: string;
  title: string;
  /** Who makes it, for the picker's groups once there are many platforms. */
  provider: string;
  /** One line on the home page card. */
  summary: string;
  /** The routes (`--via`) whose pages are in this path: a platform's own, a combination's one. */
  routes: string[];
}

export const platforms: Platform[] = [
  {
    id: "synapse",
    kind: "platform",
    init: "synapse",
    title: "Azure Synapse",
    provider: "Microsoft Azure",
    summary: "Workspace pipelines that copy Azure SQL, and serverless SQL views over the files.",
    routes: ["synapse"],
  },
  {
    id: "databricks",
    kind: "platform",
    init: "databricks",
    title: "Databricks",
    provider: "Databricks",
    summary: "Pipelines that read sources into managed tables, deployed as one bundle.",
    routes: ["databricks"],
  },
  {
    id: "adf",
    kind: "platform",
    init: "adf-landing",
    title: "Azure Data Factory",
    provider: "Microsoft Azure",
    summary: "A factory that copies sources into landing storage, deployed as an ARM template.",
    routes: ["adf-landing"],
  },
  {
    id: "duckdb",
    kind: "platform",
    init: "duckdb",
    title: "DuckDB",
    provider: "DuckDB",
    summary: "Tables built from files on one machine, with SQL you can read.",
    routes: ["duckdb"],
  },
  {
    id: "adf-databricks",
    kind: "combined",
    parts: ["adf", "databricks"],
    init: "adf-databricks",
    title: "Data Factory into Databricks",
    provider: "Combined",
    summary:
      "A factory copies each source into landing storage; Databricks pipelines load the tables.",
    routes: ["adf-databricks"],
  },
  {
    id: "adf-synapse",
    kind: "combined",
    parts: ["adf", "synapse"],
    init: "adf-synapse",
    title: "Data Factory into Synapse",
    provider: "Combined",
    summary: "A factory copies each source into landing storage; Synapse serves it as views.",
    routes: ["adf-synapse"],
  },
  {
    id: "adf-duckdb",
    kind: "combined",
    parts: ["adf", "duckdb"],
    init: "adf-duckdb",
    title: "Data Factory into DuckDB",
    provider: "Combined",
    summary:
      "A factory copies each source into landing storage; DuckDB builds the tables in Azure.",
    routes: ["adf-duckdb"],
  },
];

/** The platforms, without the combinations. */
export const singlePlatforms = platforms.filter((platform) => platform.kind === "platform");

/** The platform ids. */
export const platformIds = platforms.map((platform) => platform.id);

/** A platform by id; throws for an unknown one. */
export function platformById(id: string): Platform {
  const found = platforms.find((platform) => platform.id === id);
  if (!found) throw new Error(`Unknown platform "${id}". Choose ${platformIds.join(", ")}.`);
  return found;
}

/** The platform whose path a route's pages are in. */
export function platformOfRoute(via: string): Platform {
  const found = platforms.find((platform) => platform.routes.includes(via));
  if (!found) throw new Error(`No platform path holds the route "${via}".`);
  return found;
}

/** A section of a platform's site, in tab order. Each is a root folder: `synapse/(guides)/`. */
export type SectionId = "start" | "guides" | "standards" | "connectors" | "concepts" | "reference";

/** The sections, in tab order. Concepts and Reference also hold the product-wide pages. */
export const platformSections: SectionId[] = [
  "start",
  "guides",
  "standards",
  "connectors",
  "concepts",
  "reference",
];

/** Each section's tab title, which its folder's meta.json repeats. */
export const sectionTitles: Record<SectionId, string> = {
  start: "Get started",
  guides: "Guides",
  standards: "Standards",
  connectors: "Connectors",
  concepts: "Concepts",
  reference: "Reference",
};

/** A section's folder in a platform folder: `(guides)`, or `connectors`, whose name is in its URLs. */
export const sectionFolder = (section: SectionId) =>
  section === "connectors" ? "connectors" : `(${section})`;

const all: Platform["id"][] = ["synapse", "databricks", "adf", "duckdb"];
const targets: Platform["id"][] = ["synapse", "databricks", "duckdb"];
const combined: Platform["id"][] = ["adf-databricks", "adf-synapse", "adf-duckdb"];

/**
 * The pages several platforms show, each one file, content/shared/<key>.mdx,
 * and the platforms that show it. Each of those platforms has a stub,
 * <platform>/(<section>)/<name>.mdx, that includes it; lib/remark-only.ts
 * keeps each platform's <Only> blocks.
 */
export const sharedPages: Record<string, { section: SectionId; platforms: Platform["id"][] }> = {
  "start/install": { section: "start", platforms: all },
  "start/first-project": { section: "start", platforms: [...all, ...combined] },
  "start/how-it-works": { section: "start", platforms: all },
  "guides/create-a-project": { section: "guides", platforms: all },
  "guides/plan-and-generate": { section: "guides", platforms: all },
  "guides/add-a-source": { section: "guides", platforms: all },
  "guides/describe-a-source": { section: "guides", platforms: all },
  "guides/write-a-contract": { section: "guides", platforms: all },
  "guides/write-a-transform": { section: "guides", platforms: targets },
  "guides/keep-a-table-current": { section: "guides", platforms: targets },
  "guides/cleanse-data": { section: "guides", platforms: targets },
  "guides/add-quality-checks": { section: "guides", platforms: targets },
  "guides/grant-access": { section: "guides", platforms: ["synapse", "databricks"] },
  "guides/define-a-data-product": { section: "guides", platforms: all },
  "guides/run-a-flow-on-its-own-triggers": {
    section: "guides",
    platforms: ["synapse", "adf", "adf-databricks"],
  },
  "guides/add-an-environment": { section: "guides", platforms: all },
  "guides/check-in-ci": { section: "guides", platforms: all },
  "guides/deploy-through-environments": {
    section: "guides",
    platforms: ["synapse", "databricks", "adf"],
  },
  "guides/ask-the-platform-team": { section: "guides", platforms: all },
  "standards/configure-a-standard": { section: "standards", platforms: all },
  "standards/choose-a-published-standard": {
    section: "standards",
    platforms: ["databricks", "duckdb"],
  },
  "standards/start-from-a-published-standard": {
    section: "standards",
    platforms: ["databricks", "duckdb"],
  },
  "standards/upgrade-a-standard": { section: "standards", platforms: ["databricks", "duckdb"] },
  "standards/name-things-your-way": { section: "standards", platforms: all },
  "standards/accept-a-warning": { section: "standards", platforms: all },
  "standards/share-a-template": { section: "standards", platforms: all },
  "standards/upgrade": { section: "standards", platforms: all },
  "concepts/environments-and-platform": { section: "concepts", platforms: all },
  "concepts/not-applied": { section: "concepts", platforms: all },
};

/** The pages only one platform has, by section, which live in its folder. */
export const ownPages: Record<Platform["id"], Partial<Record<SectionId, string[]>>> = {
  synapse: {
    start: ["index"],
    guides: ["deploy"],
    reference: ["troubleshooting"],
  },
  databricks: {
    start: ["index"],
    guides: ["deploy"],
    standards: ["lakehouse-streaming"],
    reference: ["troubleshooting"],
  },
  adf: {
    start: ["index"],
    guides: ["land-files-only", "pipelines", "deploy"],
    reference: ["troubleshooting"],
  },
  duckdb: {
    start: ["index"],
    standards: ["local-medallion"],
    reference: ["troubleshooting"],
  },
  // A combination has only what the two platforms' own sites do not: the
  // overview, its first project, loading the landed files, and deploying both.
  "adf-databricks": {
    start: ["index"],
    guides: ["load-with-adf", "deploy"],
  },
  "adf-synapse": {
    start: ["index"],
    guides: ["load-with-adf", "deploy"],
  },
  "adf-duckdb": {
    start: ["index"],
    guides: ["load-with-adf", "deploy"],
  },
};

/** A shared page's file name, which is its URL's last part: `write-a-contract`. */
export const pageName = (key: string) => key.split("/").at(-1)!;

/** The shared page with this name, or undefined. */
export function sharedPageNamed(name: string): string | undefined {
  return Object.keys(sharedPages).find((key) => pageName(key) === name);
}

/** The pages in one section of a platform's site: its shared pages and its own. */
export function pagesFor(id: Platform["id"], section: SectionId): string[] {
  const shared = Object.entries(sharedPages)
    .filter(([, page]) => page.section === section && page.platforms.includes(id))
    .map(([key]) => pageName(key));
  return [...(ownPages[id][section] ?? []), ...shared];
}

/**
 * The sites whose route reads no source, so they have no Connectors section:
 * DuckDB on its own builds tables from files in the project.
 * test/combined-sites.test.ts checks this against the connectors each route reads.
 */
export const loadsNoSource: Platform["id"][] = ["duckdb"];

/** The sections a site has, in tab order: Connectors where it loads sources, and each other with pages. */
export function sectionsOf(id: Platform["id"]): SectionId[] {
  return platformSections.filter((section) =>
    section === "connectors" ? !loadsNoSource.includes(id) : pagesFor(id, section).length > 0,
  );
}

/** The pack that reads a source on a route: ADF on the `adf-…` routes, else the route's own. */
export const readerPack = (via: string) => (via.startsWith("adf-") ? "adf" : via);

/** The packs that read sources on a platform's routes, in route order. */
export function platformPacks(id: Platform["id"]): string[] {
  return [...new Set(platformById(id).routes.map(readerPack))];
}

/**
 * The platform a page belongs to, from its path under content/docs or its URL:
 * `synapse/write-a-contract.mdx` or `/docs/synapse/write-a-contract`.
 */
export function platformOfPath(path: string): Platform["id"] | undefined {
  const first = path
    .replaceAll("\\", "/")
    .replace(/^.*?content\/docs\//, "")
    .replace(/^\/?docs\//, "")
    .replace(/^\//, "")
    .split("/")[0];
  return platformIds.find((id) => id === first);
}

/**
 * Each shared page's old URL path, which is now a page listing its versions
 * (content/docs/(moved)/<old>.mdx): guides and standards were under
 * /docs/how-to/, the getting-started pages under /docs/start/.
 */
export const movedPages: Record<string, string> = Object.fromEntries(
  Object.keys(sharedPages).map((key) => {
    const name = pageName(key);
    const old =
      key.startsWith("guides/") || key.startsWith("standards/")
        ? `how-to/${name === "create-a-project" ? "start-from-a-template" : name}`
        : key;
    return [old, key];
  }),
);

/**
 * Words that name a platform, its engine or its tools, in any case, and so
 * links to its site. On another site's page they are a slip:
 * test/platform-leak.test.ts counts them. A combination's pages may name its
 * two platforms (allowedOn).
 */
export const leakWords: Record<"synapse" | "databricks" | "adf" | "duckdb", RegExp> = {
  synapse: /\b(?:synapse|serverless SQL)\b/gi,
  databricks: /\b(?:databricks|Unity Catalog|PySpark|Lakeflow)\b/gi,
  adf: /\b(?:Data Factory|ADF)\b|\badf(?=@|-[a-z]|\b)/gi,
  duckdb: /\bduckdb\b/gi,
};

/** The platforms a site's pages may name: its own, or a combination's two. */
export function allowedOn(id: Platform["id"]): string[] {
  const site = platformById(id);
  return site.parts ?? [site.id];
}

/**
 * Whether a connector's note shows on a platform's copy of its page: a note in
 * a pack's slot (`adf-reading`) only where that pack reads sources, and the
 * examples' notes everywhere. lib/remark-only.ts drops the others.
 */
export function noteShownOn(slot: string, on: Platform["id"]): boolean {
  return slot === "examples" || platformPacks(on).includes(slot.split("-")[0]!);
}

/** Each platform's pages by section, in sidebar order: lib/areas.ts's siteSections. */
export type Sites = Record<string, Partial<Record<SectionId, string[]>>>;

/**
 * Where the platform picker goes from a page: the same page on the new
 * platform, else the first page of the same section there, else the new
 * platform's overview. Between a platform and a combination, a page the other
 * lacks opens its overview. A product-wide page stays. A `#section` is kept.
 * @example switchTarget("/docs/synapse/grant-access", "duckdb", sites) // "/docs/duckdb/create-a-project"
 */
export function switchTarget(path: string, to: Platform["id"], sites: Sites): string {
  const [rawPage = "", hash] = path.split("#");
  const page = rawPage.length > 1 ? rawPage.replace(/\/$/, "") : rawPage;
  const from = platformOfPath(page);
  if (!from) return path;
  const there = Object.values(sites[to] ?? {}).flat();
  const same = `/docs/${to}${page.slice(`/docs/${from}`.length)}`;
  if (there.includes(same)) return hash === undefined ? same : `${same}#${hash}`;
  // Between a platform and a combination, a page the other lacks opens its overview.
  if (platformById(from).kind !== platformById(to).kind) return `/docs/${to}`;
  const section = (Object.entries(sites[from] ?? {}) as [SectionId, string[]][]).find(([, urls]) =>
    urls.includes(page),
  )?.[0];
  return (section && sites[to]?.[section]?.[0]) ?? `/docs/${to}`;
}

/**
 * The platform whose tabs a page shows, for <html data-site>: the page's own,
 * else the one the reader chose last, else none.
 * @example siteMark("/docs/concepts/definitions", "synapse") // "synapse"
 */
export function siteMark(path: string, remembered: string | undefined): string | undefined {
  return platformOfPath(path) ?? remembered;
}

/** One group in the platform picker. */
export interface PickerGroup {
  /** The group's name, for its label: a provider, "Platforms" or "Combined". */
  label: string;
  /** Whether a line comes before it: the combinations, after the platforms. */
  separated: boolean;
  items: Platform[];
}

/** More platforms than this, and the picker gets a filter box and provider groups. */
export const manyPlatforms = 8;

/**
 * The picker's groups for a filter: the platforms (by provider once there are
 * more than eight), then a line and the combinations under "Combined". A group
 * the filter empties is left out.
 * @example pickerGroups("synapse") // Platforms: Azure Synapse; Combined: Data Factory into Synapse
 */
export function pickerGroups(filter: string): PickerGroup[] {
  const wanted = filter.trim().toLowerCase();
  const shown = platforms.filter((platform) =>
    `${platform.title} ${platform.provider}`.toLowerCase().includes(wanted),
  );
  const single = shown.filter((platform) => platform.kind === "platform");
  const combined = shown.filter((platform) => platform.kind === "combined");
  const groups: PickerGroup[] =
    singlePlatforms.length > manyPlatforms
      ? [...new Set(single.map((platform) => platform.provider))].map((provider) => ({
          label: provider,
          separated: false,
          items: single.filter((platform) => platform.provider === provider),
        }))
      : [{ label: "Platforms", separated: false, items: single }];
  groups.push({ label: "Combined", separated: true, items: combined });
  return groups.filter((group) => group.items.length > 0);
}
