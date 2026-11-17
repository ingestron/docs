// Keeps a platform page to its platform. A shared guide (content/shared/) is
// included by a page in each platform folder; after the include, this plugin
// keeps the <Only on="…"> blocks that name the page's platform, unwrapped, and
// removes the others, so the page's headings, contents and search entries hold
// only its platform's text. It also turns a link to `/docs/~/<page>` into the
// same platform's page, and a component's `platform="~"` into the page's
// platform, and an example name ending in `-~` into that platform's example.
// Text for tests: lib/platform-text.ts does the same.
import {
  loadsNoSource,
  movedPages,
  noteShownOn,
  platformIds,
  platformOfPath,
  sharedPageNamed,
  sharedPages,
  type Platform,
} from "./platforms";

/** An MDX prop written as an expression, with its compiled tree. */
interface Expression {
  value?: string;
  data?: { estree?: unknown };
}

/** Rewrites each string literal in an estree that starts with `/docs/~/`. */
function literals(node: unknown, swap: (url: string) => string): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) literals(item, swap);
    return;
  }
  const literal = node as { type?: string; value?: unknown; raw?: string };
  if (
    literal.type === "Literal" &&
    typeof literal.value === "string" &&
    literal.value.startsWith(here)
  ) {
    literal.value = swap(literal.value);
    literal.raw = JSON.stringify(literal.value);
    return;
  }
  for (const [key, value] of Object.entries(node))
    if (key !== "loc" && key !== "range") literals(value, swap);
}

interface Node {
  type: string;
  name?: string | null;
  url?: string;
  attributes?: { type: string; name?: string; value?: unknown }[];
  children?: Node[];
}

/** The platform marker in a link: `/docs/~/write-a-contract`. */
export const here = "/docs/~/";

/**
 * Where `/docs/~/<page>` goes on a platform: that platform's page, or, for a
 * shared page the platform leaves out, the page's old URL, which lists the
 * platforms that have it.
 * @example hereOn("/docs/~/grant-access#roles", "duckdb") // "/docs/how-to/grant-access#roles"
 */
export function hereOn(url: string, platform: string): string {
  const rest = url.slice(here.length);
  const name = rest.split("#")[0]!;
  // A site that loads no source has no catalogue: the list of every source.
  if (name === "connectors" && loadsNoSource.includes(platform as Platform["id"]))
    return `/docs/connectors${rest.slice(name.length)}`;
  const key = sharedPageNamed(name);
  if (!key || (sharedPages[key]!.platforms as string[]).includes(platform))
    return `/docs/${platform}/${rest}`;
  const old = Object.entries(movedPages).find(([, to]) => to === key)![0];
  return `/docs/${old}${rest.slice(name.length)}`;
}

/** The platforms an <Only> names, checked against the known ids. */
export function onlyPlatforms(on: string, where: string): string[] {
  const ids = on.split(/[\s,]+/).filter(Boolean);
  const unknown = ids.filter((id) => !(platformIds as string[]).includes(id));
  if (ids.length === 0 || unknown.length)
    throw new Error(`<Only on="${on}"> in ${where}: use ${platformIds.join(", ")}.`);
  return ids;
}

/** The remark plugin. A page outside a platform folder may not hold an <Only> or a `/docs/~/` link. */
export function remarkOnly() {
  return (tree: unknown, file: { path?: string }) => {
    const where = file.path ?? "a page";
    const platform = platformOfPath(where);
    visit(tree as Node, platform, where);
  };
}

function visit(node: Node, platform: string | undefined, where: string): void {
  if (!node.children) return;
  const kept: Node[] = [];
  for (const child of node.children) {
    if (isOnly(child)) {
      const on = String(child.attributes?.find((item) => item.name === "on")?.value ?? "");
      if (!platform) throw new Error(`<Only> outside a platform page, in ${where}.`);
      if (!onlyPlatforms(on, where).includes(platform)) continue;
      visit(child, platform, where);
      kept.push(...(child.children ?? []));
      continue;
    }
    // A connector's note for a pack this platform does not use goes with its headings.
    if (isNote(child) && platform) {
      const at = String(child.attributes?.find((item) => item.name === "at")?.value ?? "");
      if (!noteShownOn(at, platform as Platform["id"])) continue;
    }
    relink(child, platform, where);
    visit(child, platform, where);
    kept.push(child);
  }
  node.children = kept;
}

const isNote = (node: Node) => node.type === "mdxJsxFlowElement" && node.name === "ConnectorNote";

const isOnly = (node: Node) =>
  (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name === "Only";

function relink(node: Node, platform: string | undefined, where: string): void {
  const swap = (url: string) => {
    if (!url.startsWith(here)) return url;
    if (!platform) throw new Error(`A link to ${url} outside a platform page, in ${where}.`);
    return hereOn(url, platform);
  };
  if (node.type === "link" && node.url) node.url = swap(node.url);
  for (const attribute of node.attributes ?? []) {
    // A prop written as an expression, `items={[{ href: "/docs/~/…" }]}`: its
    // string literals, in the compiled tree and in its source text.
    if (attribute.value && typeof attribute.value === "object") {
      const expression = attribute.value as Expression;
      if (expression.value?.includes(here)) {
        expression.value = expression.value.replace(new RegExp(`${here}[a-z0-9/#-]*`, "g"), swap);
        literals(expression.data?.estree, swap);
      }
      continue;
    }
    if (typeof attribute.value !== "string") continue;
    // `platform="~"` on a component is the page's platform, and an example
    // named `data-products-~` is that platform's: `data-products-synapse`.
    if (attribute.name === "platform" && attribute.value === "~") {
      if (!platform) throw new Error(`platform="~" outside a platform page, in ${where}.`);
      attribute.value = platform;
    } else if (attribute.name === "name" && attribute.value.endsWith("-~")) {
      if (!platform)
        throw new Error(`name="${attribute.value}" outside a platform page, in ${where}.`);
      attribute.value = `${attribute.value.slice(0, -1)}${platform}`;
    } else attribute.value = swap(attribute.value);
  }
}
