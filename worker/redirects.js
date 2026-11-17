// Moved and merged pages. A page that is removed or renamed gets an entry here
// in the same change, so an old link, bookmark or search result still lands.
// scripts/check-links.ts checks every target against the built site.

/** Exact old path to new path. A target may end in `#anchor`. */
export const redirects = new Map([
  // Data Factory into a platform has a site of its own (the combined sites).
  ["/docs/databricks/load-with-adf", "/docs/adf-databricks/load-with-adf"],
  ["/docs/synapse/load-with-adf", "/docs/adf-synapse/load-with-adf"],
  ["/docs/duckdb/load-with-adf", "/docs/adf-duckdb/load-with-adf"],
  ["/docs/duckdb/deploy-through-environments", "/docs/adf-duckdb/deploy"],
  ["/docs/duckdb/connectors", "/docs/adf-duckdb/connectors"],
  ["/docs/start", "/docs"],
  ["/docs/start/choose-a-route", "/docs/concepts/choose-a-platform"],
  ["/docs/how-to", "/docs/how-to/configure-a-standard"],
  ["/docs/concepts", "/docs/concepts/definitions"],
  ["/docs/reference", "/docs/reference/documents"],
  ["/docs/tools", "/docs/tools/vscode"],
  ["/docs/tools/cli", "/docs/reference/cli"],
  ["/docs/examples", "/docs/reference/templates"],
  ["/docs/examples/catalogue", "/docs/reference/templates"],
  ["/docs/how-to/use-an-example", "/docs/reference/templates#create-a-project-from-a-starter"],
  [
    "/docs/how-to/draft-a-contract-from-a-sample",
    "/docs/how-to/write-a-contract#draft-from-a-sample",
  ],
  ["/docs/concepts/naming", "/docs/how-to/name-things-your-way"],
  ["/docs/examples/organisation-standards", "/docs/how-to/configure-a-standard"],
  ["/docs/concepts/connectivity", "/docs/concepts/choose-a-platform#reachability"],
  ["/docs/how-to/serve-files-as-sql", "/docs/synapse"],
  ["/docs/how-to/run-locally-with-duckdb", "/docs/duckdb"],
  ["/docs/how-to/run-duckdb-in-azure", "/docs/adf-duckdb/load-with-adf"],
  ["/docs/how-to/land-files-only", "/docs/adf/land-files-only"],
  ["/docs/examples/retail", "/docs/databricks"],
  ["/docs/how-to/databricks", "/docs/databricks"],
  ["/docs/how-to/deploy-the-bundle", "/docs/databricks/deploy#deploy"],
  ["/docs/how-to/manage-schemas", "/docs/databricks#create-the-schemas"],
  ["/docs/how-to/refresh-on-a-schedule", "/docs/databricks#schedule"],
  ["/docs/how-to/adf", "/docs/adf"],
  ["/docs/how-to/adf-native-connectors", "/docs/adf"],
  ["/docs/how-to/adf-runtime", "/docs/adf#runtime-and-key-vault"],
  ["/docs/how-to/publish-adf", "/docs/adf/deploy#deploy"],
  ["/docs/how-to/design-adf-pipelines", "/docs/adf/pipelines"],
  ["/docs/how-to/name-adf-resources", "/docs/adf/pipelines#name-resources"],
  // The platform pages moved into each platform's path (2026-11-16).
  ["/docs/platforms", "/docs"],
  ["/docs/platforms/synapse", "/docs/synapse"],
  ["/docs/platforms/databricks", "/docs/databricks"],
  ["/docs/platforms/databricks-deploy", "/docs/databricks/deploy"],
  ["/docs/platforms/adf", "/docs/adf"],
  ["/docs/platforms/adf-deploy", "/docs/adf/deploy"],
  ["/docs/platforms/adf-pipelines", "/docs/adf/pipelines"],
  ["/docs/platforms/landing-only", "/docs/adf/land-files-only"],
  ["/docs/platforms/duckdb", "/docs/duckdb"],
  ["/docs/platforms/duckdb-in-azure", "/docs/adf-duckdb/load-with-adf"],
  ["/docs/how-to/kits", "/docs/how-to/choose-a-published-standard"],
  ["/docs/how-to/kits/databricks-lakehouse-streaming", "/docs/databricks/lakehouse-streaming"],
  ["/docs/how-to/kits/duckdb-local-medallion", "/docs/duckdb/local-medallion"],
  // The connector categories are headings on the catalogue now. Listed one by
  // one: a pattern for /docs/connectors/<name> would also match every connector.
  ["/docs/connectors/databases-and-analytics", "/docs/connectors#databases-and-analytics"],
  ["/docs/connectors/business-applications", "/docs/connectors#business-applications"],
  ["/docs/connectors/sap", "/docs/connectors#sap"],
  ["/docs/connectors/apis-and-protocols", "/docs/connectors#apis-and-protocols"],
  ["/docs/connectors/files-and-storage", "/docs/connectors#files-and-storage"],
  ["/docs/connectors/streaming", "/docs/connectors#streaming"],
]);

/**
 * Old paths by shape: a pattern and the function that builds the new path.
 * A connector's chapters are sections of its one page now.
 * @type {[RegExp, (match: RegExpMatchArray) => string][]}
 */
/** The connectors each platform still loads on its own: test/combined-redirects.test.ts checks them. */
const ownConnectors = {
  databricks: ["files", "kafka", "salesforce", "sqlserver"],
  synapse: ["azure-sql-database"],
  duckdb: [],
};

/** @type {[RegExp, (match: RegExpMatchArray) => string | undefined][]} */
export const patterns = [
  // A connector page a platform lost to its combination: the page that lists
  // every site that loads the source.
  [
    /^\/docs\/(databricks|synapse|duckdb)\/connectors\/([a-z0-9-]+)$/,
    (match) =>
      ownConnectors[match[1]].includes(match[2]) ? undefined : `/docs/connectors/${match[2]}`,
  ],
  [
    /^\/docs\/connectors\/([a-z0-9-]+)\/([a-z0-9]+)-connection$/,
    (match) => `/docs/connectors/${match[1]}#${match[2]}-connection`,
  ],
  [
    /^\/docs\/connectors\/([a-z0-9-]+)\/([a-z0-9]+)-ingestion$/,
    (match) => `/docs/connectors/${match[1]}#${match[2]}-ingestion`,
  ],
  [
    /^\/docs\/connectors\/([a-z0-9-]+)\/examples$/,
    (match) => `/docs/connectors/${match[1]}#examples`,
  ],
];

/**
 * The path to send an old URL to, with its query kept, or undefined when the
 * URL is not redirected. One trailing `/` or `.html` is ignored.
 */
export function redirectFor(url, table = { redirects, patterns }) {
  const path = url.pathname.replace(/(?:\/|\.html)$/, "");
  const target = table.redirects.get(path) ?? firstMatch(table.patterns, path);
  if (target === undefined) return undefined;
  if (!url.search) return target;
  const hash = target.indexOf("#");
  return hash === -1
    ? `${target}${url.search}`
    : `${target.slice(0, hash)}${url.search}${target.slice(hash)}`;
}

function firstMatch(list, path) {
  for (const [pattern, build] of list) {
    const match = path.match(pattern);
    if (match) return build(match);
  }
  return undefined;
}
