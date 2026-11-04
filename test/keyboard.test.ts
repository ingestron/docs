// The keyboard fixes on top of Fumadocs: the rules they follow, run on plain
// objects, and the wiring and styles that apply them. scripts/check-links.ts
// checks the built pages: the skip link first, and every frame named.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CliCommands } from "../components/reference/cli-commands";
import { RouteComparison } from "../components/reference/route-comparison";
import { RouteTable } from "../components/reference/route-table";
import { SettingsTable } from "../components/reference/settings-table";
import { MarkdownTable, TableFrame } from "../components/table-frame";
import { areaTabs } from "../lib/areas";
import { outside, tabCurrent, type ElementLike } from "../lib/keyboard";
import { codeName, rehypeFrameNames, tableName } from "../lib/rehype-frame-names";
import { tree as pageTree } from "./tree.js";

const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** A tree of plain objects shaped like DOM elements. */
function tree(shape: Record<string, string[]>, rootName: string) {
  const nodes = new Map<string, ElementLike & { name: string }>();
  const node = (name: string, parent: ElementLike | null): ElementLike & { name: string } => {
    const made = { name, parentElement: parent, children: [] as ElementLike[] };
    nodes.set(name, made);
    made.children = (shape[name] ?? []).map((child) => node(child, made));
    return made;
  };
  node(rootName, null);
  return (name: string) => nodes.get(name)!;
}

describe("the phone menu", () => {
  // body > [skip, layout > [header, overlay, drawer > [links], main], announcer]
  const get = tree(
    {
      body: ["skip", "layout", "announcer"],
      layout: ["header", "overlay", "drawer", "main"],
      drawer: ["links"],
    },
    "body",
  );

  it("makes everything outside the open menu inert, but the overlay that closes it", () => {
    const names = outside(get("drawer"), get("body"), [get("overlay")]).map(
      (node) => (node as unknown as { name: string }).name,
    );
    expect(names.sort()).toEqual(["announcer", "header", "main", "skip"]);
  });

  it("is a dialog that Escape closes, wired inside the areas' layout", () => {
    const keyboard = file("components/keyboard.tsx");
    for (const text of [
      '"nd-sidebar-mobile"',
      'setAttribute("role", "dialog")',
      'setAttribute("aria-modal", "true")',
      'event.key !== "Escape"',
      "setOpen(false)",
      "element.inert = true",
      // Focus into the menu, since its own button is now inert.
      "drawer.querySelector<HTMLElement>(focusable)?.focus();",
      // Escape leaves a dialog opened over the menu, such as search, to close itself.
      "(layer && layer !== drawer)",
      // Closed, it is an ordinary sidebar again.
      "drawer.removeAttribute(name)",
      'aria-controls="nd-sidebar-mobile"',
    ])
      expect(keyboard).toContain(text);
    expect(file("app/docs/(areas)/layout.tsx")).toContain("<MenuDialog />");
  });
});

describe("the area tabs", () => {
  const tabs = areaTabs(pageTree).map(({ url, urls }) => ({
    url,
    urls: [...(urls ?? [])],
  }));
  const current = (path: string) =>
    Object.fromEntries(
      tabCurrent(tabs, path)
        .map((value, index) => [tabs[index]!.url, value])
        .filter(([, value]) => value),
    );

  it("marks the tab the page opens as the page, and its area's other pages as current", () => {
    expect(current("/docs/start/first-project")).toEqual({ "/docs/start/first-project": "page" });
    expect(current("/docs/start/how-it-works")).toEqual({ "/docs/start/first-project": "true" });
    expect(current("/docs/reference/packs/adf")).toEqual({ "/docs/reference/documents": "true" });
    expect(current("/docs/connectors")).toEqual({ "/docs/connectors": "page" });
    expect(current("/docs/connectors/sqlserver/")).toEqual({ "/docs/connectors": "true" });
    expect(current("/docs")).toEqual({});
  });

  it("is set by a client effect in the areas' layout", () => {
    expect(file("app/docs/(areas)/layout.tsx")).toContain("<AreaTabsCurrent");
    expect(file("components/keyboard.tsx")).toContain("[data-header-tabs] a[href]");
  });
});

describe("the skip link and search", () => {
  it("opens each layout, and lands on an element that takes focus", () => {
    expect(file("app/docs/(areas)/layout.tsx")).toContain('<SkipLink target="nd-page" />');
    expect(file("app/docs/(areas)/[...slug]/page.tsx")).toContain("tabIndex={-1}");
    expect(file("app/docs/(hub)/layout.tsx")).toContain('<SkipLink target="hub" />');
    expect(file("app/docs/(hub)/page.tsx")).toContain('id="hub" tabIndex={-1}');
  });

  it("puts focus back where it was when search closes", () => {
    expect(file("app/layout.tsx")).toContain("<SearchFocusReturn />");
    // Not after a result has gone to another page or section.
    expect(file("components/keyboard.tsx")).toContain("here === openedOn.current");
  });
});

describe("focus styles", () => {
  const css = file("app/keyboard.css");
  /** The declarations of the rule whose selector is exactly `selector`. */
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("}", at));
  };

  it("shows every control that takes focus", () => {
    expect(file("app/global.css")).toContain('@import "./keyboard.css";');
    expect(rule(":is(h1, h2, h3, h4, h5, h6) > button:focus-visible")).toContain("opacity: 1");
    expect(rule('[role="tab"]:focus-visible,\n[role="tabpanel"]:focus-visible')).toContain(
      "outline: 2px solid var(--color-fd-ring)",
    );
    expect(rule('[role="tabpanel"]:focus-visible::after')).toContain(
      "border: 2px solid var(--color-fd-ring)",
    );
    expect(rule("[data-toc-popover-trigger]:focus-visible")).toContain(
      "outline: 2px solid var(--color-fd-ring)",
    );
    expect(rule(".skip-link:focus")).toContain("transform: none");
    expect(rule(".table-frame:focus-visible")).toContain("outline: 2px solid");
  });

  it("lets a code block's file name wrap", () => {
    expect(rule("figure.shiki figcaption")).toContain("white-space: normal");
  });
});

describe("scrolling frames", () => {
  it("scroll themselves, so a table in a frame does not scroll on its own", () => {
    const global = file("app/global.css");
    expect(global).toContain(".prose :not(.table-frame) > table {");
    expect(global).not.toMatch(/^\.prose table \{/m);
  });

  it("are one named, focusable region around each table", () => {
    const frame =
      /<div class="[^"]*table-frame[^"]*" tabindex="0" role="region" aria-label="([^"]+)">\s*<table/g;
    const label = (html: string) => [...html.matchAll(frame)].map((match) => match[1]);
    expect(
      label(
        renderToStaticMarkup(
          createElement(TableFrame, { label: "Steps", children: createElement("table") }),
        ),
      ),
    ).toEqual(["Steps"]);
    expect(label(renderToStaticMarkup(createElement(MarkdownTable, {})))).toEqual(["Table"]);
    expect(
      label(
        renderToStaticMarkup(createElement(MarkdownTable, { "data-frame-label": "Table: Use" })),
      ),
    ).toEqual(["Table: Use"]);
    for (const [element, names] of [
      [createElement(RouteTable), ["Where your data can go"]],
      [createElement(RouteComparison, { ids: ["files"] }), ["Routes for each source"]],
      [createElement(CliCommands), ["Commands", "Options"]],
      [
        createElement(SettingsTable, { pack: "duckdb", method: "duckdb-table" }),
        ["Settings of duckdb-table"],
      ],
    ] as const) {
      const html = renderToStaticMarkup(element);
      expect(label(html)).toEqual(names);
      expect((html.match(/<table/g) ?? []).length).toBe(names.length);
    }
  });

  it("name a code block by its file, or by what it holds and its heading", () => {
    expect(codeName("yaml", "flows/orders.yaml", "Add a column")).toBe("flows/orders.yaml");
    expect(codeName("sh", undefined, "2. Plan")).toBe("Commands: 2. Plan");
    expect(codeName("text", undefined, "2. Plan")).toBe("Output: 2. Plan");
    expect(codeName("toml", undefined)).toBe("TOML");
    expect(codeName(undefined, undefined)).toBe("Code");
    expect(tableName("Reachability")).toBe("Table: Reachability");
    expect(tableName()).toBe("Table");
  });

  it("are named in reading order, after the heading above them", () => {
    const element = (tagName: string, children: object[] = [], properties = {}) => ({
      type: "element",
      tagName,
      properties,
      children,
    });
    const text = (value: string) => ({ type: "text", value });
    const before = element("table");
    const pre = element("pre", [
      element("code", [text("ingestron plan")], { className: ["language-sh"] }),
    ]);
    const titled = element("pre", [element("code", [], { className: ["language-yaml"] })], {
      title: "standard.yaml",
    });
    const table = element("table");
    const root = {
      type: "root",
      children: [
        before,
        element("h2", [text("Plan")]),
        pre,
        titled,
        element("h3", [text("Fields")]),
        table,
      ],
    };
    rehypeFrameNames()(root as Parameters<ReturnType<typeof rehypeFrameNames>>[0]);
    expect(before.properties).toEqual({ dataFrameLabel: "Table" });
    expect(pre.properties).toEqual({ dataFrameLabel: "Commands: Plan" });
    expect(titled.properties).toMatchObject({ dataFrameLabel: "standard.yaml" });
    expect(table.properties).toEqual({ dataFrameLabel: "Table: Fields" });
  });

  it("are named in every page's code blocks, through the language Fumadocs adds", () => {
    const config = file("source.config.ts");
    expect(config).toContain("addLanguageClass: true");
    expect(config).toContain("rehypeFrameNames]");
    expect(file("components/mdx.tsx")).toContain('viewportProps={{ "aria-label": label }}');
    expect(file("components/example.tsx")).toContain('viewportProps={{ "aria-label":');
  });
});
