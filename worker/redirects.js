// Moved and merged pages. A page that is removed or renamed gets an entry here
// in the same change, so an old link, bookmark or search result still lands.
// scripts/check-links.ts checks every target against the built site.

/** Exact old path to new path. A target may end in `#anchor`. */
export const redirects = new Map([
  ["/docs/start", "/docs/start/first-project"],
  ["/docs/how-to", "/docs/how-to/start-from-a-template"],
  ["/docs/concepts", "/docs/concepts/definitions"],
  ["/docs/how-to/use-an-example", "/docs/how-to/start-from-a-template#start-from-a-starter"],
  [
    "/docs/how-to/draft-a-contract-from-a-sample",
    "/docs/how-to/write-a-contract#draft-from-a-sample",
  ],
  ["/docs/concepts/naming", "/docs/how-to/name-things-your-way"],
  ["/docs/examples/organisation-standards", "/docs/how-to/configure-a-standard"],
  ["/docs/concepts/connectivity", "/docs/start/choose-a-route#reachability"],
  ["/docs/how-to/serve-files-as-sql", "/docs/platforms/synapse"],
  ["/docs/how-to/run-locally-with-duckdb", "/docs/platforms/duckdb"],
  ["/docs/how-to/run-duckdb-in-azure", "/docs/platforms/duckdb-in-azure"],
  ["/docs/how-to/land-files-only", "/docs/platforms/landing-only"],
  ["/docs/examples/retail", "/docs/platforms/databricks"],
  ["/docs/how-to/databricks", "/docs/platforms/databricks"],
  ["/docs/how-to/deploy-the-bundle", "/docs/platforms/databricks#deploy"],
  ["/docs/how-to/manage-schemas", "/docs/platforms/databricks#create-the-schemas"],
  ["/docs/how-to/refresh-on-a-schedule", "/docs/platforms/databricks#schedule"],
  ["/docs/how-to/adf", "/docs/platforms/adf"],
  ["/docs/how-to/adf-native-connectors", "/docs/platforms/adf"],
  ["/docs/how-to/adf-runtime", "/docs/platforms/adf#runtime-and-key-vault"],
  ["/docs/how-to/publish-adf", "/docs/platforms/adf#publish"],
  ["/docs/how-to/design-adf-pipelines", "/docs/platforms/adf-pipelines"],
  ["/docs/how-to/name-adf-resources", "/docs/platforms/adf-pipelines#name-resources"],
]);

/** Old paths by shape: a pattern and the function that builds the new path. */
export const patterns = [];

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
