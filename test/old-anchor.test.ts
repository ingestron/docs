// An old anchor a moved section keeps (components/old-anchor.tsx): an empty
// target with the old id, so links made to it still land.
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { OldAnchor } from "../components/old-anchor";
import { anchors, read } from "./pages.js";

describe("an old anchor", () => {
  it("is an empty, hidden target with the old id", () => {
    expect(renderToStaticMarkup(createElement(OldAnchor, { id: "generate-and-publish" }))).toBe(
      '<span id="generate-and-publish" class="old-anchor" aria-hidden="true"></span>',
    );
  });

  it("refuses an id that is not an anchor", () => {
    expect(() => OldAnchor({ id: "#publish" })).toThrow('"#publish" is not an anchor');
    expect(() => OldAnchor({ id: "Publish the factory" })).toThrow("is not an anchor");
  });
});

// Every anchor the restructured platform pages had before, which other pages,
// the website and readers' bookmarks may hold. Each is still on its page: as
// a heading's id, or as an old anchor beside the section that holds it now.
const before: Record<string, string[]> = {
  synapse: [
    "list-synapse-first-and-keep-tables-as-views",
    "name-the-external-data-source",
    "write-a-transform-as-a-view",
    "generate-then-run-the-views",
    "views-or-tables",
  ],
  "landing-only": [
    "end-flows-at-the-landed-files",
    "choose-how-the-files-are-laid-out",
    "generate-and-publish",
    "what-is-not-checked",
  ],
  duckdb: [
    "read-files-where-they-are",
    "run-a-cloud-project-locally",
    "bring-a-loads-files-down",
    "run-the-same-tables-in-azure",
    "what-a-local-run-cannot-catch",
  ],
  "duckdb-in-azure": [
    "how-it-fits-together",
    "create-the-job",
    "deploy-the-sql",
    "start-it-after-the-copies",
    "hangs-failures-and-cost",
    "checked-against-live-azure-not-yet",
  ],
  "adf-pipelines": [
    "copy-every-table-with-one-foreach",
    "retry-a-failed-copy",
    "add-audit-columns",
    "file-resources-in-the-factory",
    "name-resources",
    "choose-where-the-name-belongs",
    "name-shared-resources",
    "give-the-pipeline-an-environment-specific-name",
    "review-a-rename-before-applying",
  ],
};

describe("the restructured platform pages", () => {
  const sections = ["what-you-get", "on-the-platform", "settings", "next"];
  it.each(Object.keys(before))("%s keeps every anchor it had", (page) => {
    const text = read(`platforms/${page}.mdx`);
    const ids = new Set([
      ...anchors(text).keys(),
      ...[...text.matchAll(/<OldAnchor id="([^"]+)" \/>/g)].map((match) => match[1]!),
    ]);
    for (const id of before[page]!) expect(ids, `${page}#${id}`).toContain(id);
    for (const id of sections) expect(ids, `${page}#${id}`).toContain(id);
  });

  it("put their sections in the one order every platform page follows", () => {
    const order = [
      "what-you-get",
      "on-the-platform",
      "create-it",
      "settings",
      "prerequisites",
      "deploy",
      "operate",
      "limits",
      "next",
    ];
    for (const page of Object.keys(before)) {
      const text = read(`platforms/${page}.mdx`);
      const top = [...text.matchAll(/^## .*?(?: \[#([^\]]+)\])?$/gm)].map(
        (match) => match[1] ?? "next",
      );
      const known = top.filter((id) => order.includes(id));
      expect(known, `${page}: only the platform sections, at the top level`).toEqual(top);
      expect(known, `${page}: in order`).toEqual(order.filter((id) => known.includes(id)));
    }
  });
});
