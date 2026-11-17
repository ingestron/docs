// Moving between platform sites: the picker opens the same page on the new
// platform, or that section's first page; the header holds every platform's
// section tabs, and a script before the first paint marks which platform's to
// show, from the URL or the platform the reader chose last.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { headerTabs, siteSections } from "../lib/areas.js";
import { platformSections, sectionsOf, switchTarget } from "../lib/platforms.js";
import { siteScript } from "../lib/site-script.js";
import { tree } from "./tree.js";

const sites = siteSections(tree);

describe("switchTarget", () => {
  it("opens the same page on the new platform", () => {
    expect(switchTarget("/docs/synapse/write-a-contract", "databricks", sites)).toBe(
      "/docs/databricks/write-a-contract",
    );
    expect(switchTarget("/docs/adf-synapse/connectors/sqlserver", "adf-duckdb", sites)).toBe(
      "/docs/adf-duckdb/connectors/sqlserver",
    );
    // From a platform to a combination that lacks the page: the combination's overview.
    expect(switchTarget("/docs/synapse/cleanse-data", "adf-synapse", sites)).toBe(
      "/docs/adf-synapse",
    );
    expect(switchTarget("/docs/synapse", "adf", sites)).toBe("/docs/adf");
  });

  it("opens the section's first page where the new platform lacks the page", () => {
    expect(switchTarget("/docs/synapse/grant-access", "duckdb", sites)).toBe(
      "/docs/duckdb/create-a-project",
    );
    expect(switchTarget("/docs/databricks/lakehouse-streaming", "synapse", sites)).toBe(
      "/docs/synapse/configure-a-standard",
    );
    expect(switchTarget("/docs/databricks/connectors/kafka", "adf", sites)).toBe(
      "/docs/adf/connectors",
    );
  });

  it("keeps a product-wide page, a trailing slash and a section link", () => {
    expect(switchTarget("/docs/reference/cli", "synapse", sites)).toBe("/docs/reference/cli");
    expect(switchTarget("/docs/synapse/deploy/", "databricks", sites)).toBe(
      "/docs/databricks/deploy",
    );
    expect(switchTarget("/docs/synapse/deploy#prerequisites", "databricks", sites)).toBe(
      "/docs/databricks/deploy#prerequisites",
    );
  });
});

describe("the header's tabs", () => {
  const tabs = headerTabs(tree);
  const platformOf = (tab: (typeof tabs)[number]) =>
    (tab.props as Record<string, string> | undefined)?.["data-platform"];

  it("are each platform's own sections, marked with the platform, then Concepts and Reference", () => {
    for (const id of ["synapse", "databricks", "adf", "duckdb"] as const)
      expect(
        tabs.filter((tab) => platformOf(tab) === id).map((tab) => tab.title),
        id,
      ).toEqual(
        sectionsOf(id)
          .filter((section) => section !== "concepts" && section !== "reference")
          .map(
            (section) =>
              ({
                start: "Get started",
                guides: "Guides",
                standards: "Standards",
                connectors: "Connectors",
              })[section as "start"],
          ),
      );
    const wide = tabs.filter((tab) => !platformOf(tab));
    expect(wide.map((tab) => tab.title)).toEqual(["Concepts", "Reference"]);
    expect(wide[0]!.urls!.has("/docs/duckdb/not-applied")).toBe(true);
    expect(wide[0]!.urls!.has("/docs/concepts/definitions")).toBe(true);
    expect(wide[1]!.urls!.has("/docs/adf/troubleshooting")).toBe(true);
    expect(wide[0]!.url).toBe("/docs/concepts/definitions");
    expect(platformSections.length).toBe(6);
  });

  it("are hidden for other platforms by the stylesheet", () => {
    const css = readFileSync(join(process.cwd(), "app/navigation.css"), "utf8");
    expect(css).toContain(":root:not([data-site]) a[data-platform]");
    for (const id of ["synapse", "databricks", "adf", "duckdb"])
      expect(css).toContain(
        `:root[data-site="${id}"] a[data-platform]:not([data-platform="${id}"])`,
      );
  });
});

describe("the script before the first paint", () => {
  const run = (pathname: string, stored: string | null, blocked = false) => {
    const root: { dataset: Record<string, string> } = { dataset: {} };
    runInNewContext(siteScript(), {
      location: { pathname },
      localStorage: {
        getItem: () => {
          if (blocked) throw new Error("blocked");
          return stored;
        },
      },
      document: { documentElement: root },
    });
    return root.dataset.site;
  };

  it("marks the platform of the page, else the one chosen last, else none", () => {
    expect(run("/docs/databricks/deploy", "synapse")).toBe("databricks");
    expect(run("/docs/reference/cli", "synapse")).toBe("synapse");
    expect(run("/docs/reference/cli", null)).toBeUndefined();
    expect(run("/docs/reference/cli", "oracle")).toBeUndefined();
    expect(run("/docs/reference/cli", "synapse", true)).toBeUndefined();
  });

  // In the root layout's <head>, which a page change never renders again: a
  // <script> in a layout the browser renders after a page change never runs,
  // and React reports it. PlatformMemory marks the page on each change.
  it("runs in the root layout's head, before the body, and in no other layout", () => {
    const root = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    const head = root.slice(root.indexOf("<head>"), root.indexOf("</head>"));
    expect(head).toContain("siteScript()");
    expect(root.indexOf("</head>")).toBeLessThan(root.indexOf("<body>"));
    const areas = readFileSync(join(process.cwd(), "app/docs/(areas)/layout.tsx"), "utf8");
    expect(areas).not.toContain("<script");
    expect(areas).toContain("<PlatformMemory");
  });
});
