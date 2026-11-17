// Search finds what a connector's page renders from code, at the anchors the
// page gives it, with each pack's fields under that pack's own anchors.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ConnectorPage } from "../components/reference/connector-page";
import { ProjectSources } from "../components/reference/project-sources";
import { platforms } from "../lib/platforms.js";
import { connectorsFor } from "../lib/reference.js";
import { extraStructure, searchTitle } from "../lib/search.js";

vi.mock("@/components/example", () => ({ Example: () => null }));

// The first page rendered resolves every sample, which takes seconds on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

it("names a connector's page as a connector in results, and leaves other pages' titles alone", () => {
  expect(searchTitle("/docs/databricks/connectors/files", "Files")).toBe("Files connector");
  expect(searchTitle("/docs/synapse/connectors/sqlserver", "SQL Server")).toBe(
    "SQL Server connector",
  );
  expect(searchTitle("/docs/synapse/connectors", "Connectors")).toBe("Connectors");
  expect(searchTitle("/docs/adf", "Azure Data Factory")).toBe("Azure Data Factory");
});

it("indexes connection fields at their pack's anchors on the page", () => {
  const data = extraStructure("/docs/adf/connectors/rest");
  expect(data.contents).toContainEqual(
    expect.objectContaining({
      heading: "adf-connection-client_secret",
      content: expect.stringContaining("client_secret"),
    }),
  );
  expect(data.headings.map((heading) => heading.id)).toContain("adf-connection-client_secret");
});

it("indexes each site's own connection fields: Databricks's on Databricks, the factory's on its combination", () => {
  const under = (url: string, prefix: string) =>
    extraStructure(url)
      .contents.filter((item) => item.heading?.startsWith(prefix))
      .map((item) => item.content);
  const databricks = "/docs/databricks/connectors/sqlserver";
  expect(
    under(databricks, "databricks-connection-").some((text) => text.includes("uc_connection")),
  ).toBe(true);
  expect(under(databricks, "adf-")).toEqual([]);
  const combined = "/docs/adf-databricks/connectors/sqlserver";
  expect(
    under(combined, "adf-connection-").some((text) => text.includes("host_name_in_certificate")),
  ).toBe(true);
  expect(under(combined, "databricks-connection-")).toEqual([]);
});

it("indexes only the ingestion options rendered for Microsoft 365", () => {
  const data = extraStructure("/docs/adf/connectors/microsoft-365");
  expect(data.contents).toContainEqual(
    expect.objectContaining({
      heading: "adf-table-source-options-allowed-groups",
      content: expect.stringContaining("allowed_groups"),
    }),
  );
  expect(data.contents.some((item) => item.content.includes("pagination"))).toBe(false);
});

it("indexes the words the page writes per method, such as SQL Server's watermark", () => {
  const data = extraStructure("/docs/adf/connectors/sqlserver");
  expect(data.contents).toContainEqual(
    expect.objectContaining({
      heading: "adf-reading",
      content: expect.stringContaining("watermark_column"),
    }),
  );
  // Plain text: no Markdown link syntax or backticks in the index.
  expect(data.contents.some((item) => /`|\]\(/.test(item.content))).toBe(false);
});

it("points every search heading at an id the page renders, on each platform's copy", () => {
  for (const { id: platform } of platforms)
    for (const id of connectorsFor(platform)) {
      const html = renderToStaticMarkup(createElement(ConnectorPage, { id, platform }));
      for (const heading of extraStructure(`/docs/${platform}/connectors/${id}`).headings)
        expect(html, `${platform}/${id}: #${heading.id}`).toContain(`id="${heading.id}"`);
    }
  const catalogue = renderToStaticMarkup(createElement(ProjectSources, { platform: "adf" }));
  const headings = extraStructure("/docs/adf/connectors").headings;
  expect(headings.map((heading) => heading.id)).toContain("files-and-storage");
  for (const heading of headings) expect(catalogue).toContain(`id="${heading.id}"`);
}, 120_000);
