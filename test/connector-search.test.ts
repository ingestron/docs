// Search finds what a connector's page renders from code, at the anchors the
// page gives it, with each pack's fields under that pack's own anchors.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ConnectorPage } from "../components/reference/connector-page";
import { ProjectSources } from "../components/reference/project-sources";
import { connectorIds } from "../lib/reference.js";
import { extraStructure, searchTitle } from "../lib/search.js";

vi.mock("@/components/example", () => ({ Example: () => null }));

// The first page rendered resolves every sample, which takes seconds on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

it("names a connector's page as a connector in results, and leaves other pages' titles alone", () => {
  expect(searchTitle("/docs/connectors/files", "Files")).toBe("Files connector");
  expect(searchTitle("/docs/connectors/sqlserver", "SQL Server")).toBe("SQL Server connector");
  expect(searchTitle("/docs/connectors", "Connectors")).toBe("Connectors");
  expect(searchTitle("/docs/platforms/adf", "Azure Data Factory")).toBe("Azure Data Factory");
});

it("indexes connection fields at their pack's anchors on the page", () => {
  const data = extraStructure("/docs/connectors/rest");
  expect(data.contents).toContainEqual(
    expect.objectContaining({
      heading: "adf-connection-client_secret",
      content: expect.stringContaining("client_secret"),
    }),
  );
  expect(data.headings.map((heading) => heading.id)).toContain("adf-connection-client_secret");
});

it("keeps Databricks connection fields apart from ADF credentials on a page with both", () => {
  const data = extraStructure("/docs/connectors/sqlserver");
  const under = (prefix: string) =>
    data.contents.filter((item) => item.heading?.startsWith(prefix)).map((item) => item.content);
  expect(under("databricks-connection-").some((text) => text.includes("uc_connection"))).toBe(true);
  expect(under("databricks-").some((text) => text.includes("host_name_in_certificate"))).toBe(
    false,
  );
  expect(under("adf-connection-").some((text) => text.includes("host_name_in_certificate"))).toBe(
    true,
  );
  expect(under("adf-").some((text) => text.includes("uc_connection"))).toBe(false);
});

it("indexes only the ingestion options rendered for Microsoft 365", () => {
  const data = extraStructure("/docs/connectors/microsoft-365");
  expect(data.contents).toContainEqual(
    expect.objectContaining({
      heading: "adf-table-source-options-allowed-groups",
      content: expect.stringContaining("allowed_groups"),
    }),
  );
  expect(data.contents.some((item) => item.content.includes("pagination"))).toBe(false);
});

it("indexes the words the page writes per method, such as SQL Server's watermark", () => {
  const data = extraStructure("/docs/connectors/sqlserver");
  expect(data.contents).toContainEqual(
    expect.objectContaining({
      heading: "adf-reading",
      content: expect.stringContaining("watermark_column"),
    }),
  );
  // Plain text: no Markdown link syntax or backticks in the index.
  expect(data.contents.some((item) => /`|\]\(/.test(item.content))).toBe(false);
});

it("points every search heading at an id the page renders", () => {
  for (const id of connectorIds()) {
    const html = renderToStaticMarkup(createElement(ConnectorPage, { id }));
    for (const heading of extraStructure(`/docs/connectors/${id}`).headings)
      expect(html, `${id}: #${heading.id}`).toContain(`id="${heading.id}"`);
  }
  const catalogue = renderToStaticMarkup(createElement(ProjectSources));
  const headings = extraStructure("/docs/connectors").headings;
  expect(headings.map((heading) => heading.id)).toContain("files-and-storage");
  for (const heading of headings) expect(catalogue).toContain(`id="${heading.id}"`);
}, 30_000);
