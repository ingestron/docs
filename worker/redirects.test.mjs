import assert from "node:assert/strict";
import test from "node:test";
import worker, { redirectResponseFor } from "./index.js";
import { patterns as realPatterns, redirectFor, redirects as realRedirects } from "./redirects.js";

const redirects = new Map([["/docs/a", "/docs/b"]]);
const patterns = [
  [
    /^\/docs\/connectors\/([^/]+)\/adf-connection$/,
    (match) => `/docs/connectors/${match[1]}#adf-connection`,
  ],
];
const lookup = (path) =>
  redirectFor(new URL(path, "https://docs.ingestron.io"), { redirects, patterns });

test("an exact path maps to its target", () => {
  assert.equal(lookup("/docs/a"), "/docs/b");
});

test("a trailing slash or .html is ignored", () => {
  assert.equal(lookup("/docs/a/"), "/docs/b");
  assert.equal(lookup("/docs/a.html"), "/docs/b");
});

test("the query is kept", () => {
  assert.equal(lookup("/docs/a?x=1"), "/docs/b?x=1");
});

test("the query comes before the target's anchor", () => {
  const anchored = new Map([["/docs/a", "/docs/b#c"]]);
  const url = new URL("https://docs.ingestron.io/docs/a?x=1");
  assert.equal(redirectFor(url, { redirects: anchored, patterns: [] }), "/docs/b?x=1#c");
});

test("an unknown path gives undefined", () => {
  assert.equal(lookup("/docs/unknown"), undefined);
  assert.equal(lookup("/docs/b"), undefined);
});

test("only one trailing slash or .html is stripped", () => {
  assert.equal(lookup("/docs/a//"), undefined);
  assert.equal(lookup("/docs/a.html/"), undefined);
});

test("a pattern maps a connector chapter to its anchor", () => {
  assert.equal(
    lookup("/docs/connectors/sqlserver/adf-connection"),
    "/docs/connectors/sqlserver#adf-connection",
  );
  assert.equal(
    lookup("/docs/connectors/sqlserver/adf-connection/?x=1"),
    "/docs/connectors/sqlserver?x=1#adf-connection",
  );
  assert.equal(lookup("/docs/connectors/sqlserver/adf-ingestion"), undefined);
});

test("the root is not in the map", () => {
  assert.equal(lookup("/"), undefined);
});

test("every shipped redirect goes from a clean docs path to a docs page", () => {
  assert.ok(realRedirects.size > 0);
  for (const [from, to] of realRedirects) {
    assert.match(from, /^\/docs\//, from);
    assert.doesNotMatch(from, /(?:\/|\.html)$/, from);
    assert.match(to, /^\/docs\//, `${from} → ${to}`);
  }
  for (const [pattern] of realPatterns) assert.match(pattern.source, /^\^\\\/docs\\\//);
});

test("the start section and connectivity land on their new pages", () => {
  const shipped = (path) => redirectFor(new URL(path, "https://docs.ingestron.io"));
  assert.equal(shipped("/docs/start"), "/docs/start/first-project");
  assert.equal(shipped("/docs/start/"), "/docs/start/first-project");
  assert.equal(
    shipped("/docs/concepts/connectivity.html"),
    "/docs/start/choose-a-route#reachability",
  );
});

test("the four moved platform guides land on their pages, with the query kept", () => {
  const shipped = (path) => redirectFor(new URL(path, "https://docs.ingestron.io"));
  assert.equal(shipped("/docs/how-to/run-locally-with-duckdb"), "/docs/platforms/duckdb");
  assert.equal(shipped("/docs/how-to/run-duckdb-in-azure/"), "/docs/platforms/duckdb-in-azure");
  assert.equal(shipped("/docs/how-to/serve-files-as-sql.html"), "/docs/platforms/synapse");
  assert.equal(shipped("/docs/how-to/land-files-only?x=1"), "/docs/platforms/landing-only?x=1");
});

test("the merged Databricks and ADF guides land on their sections, with the query kept", () => {
  const shipped = (path) => redirectFor(new URL(path, "https://docs.ingestron.io"));
  for (const [from, to] of [
    ["/docs/examples/retail", "/docs/platforms/databricks"],
    ["/docs/how-to/databricks/", "/docs/platforms/databricks"],
    ["/docs/how-to/deploy-the-bundle", "/docs/platforms/databricks#deploy"],
    ["/docs/how-to/manage-schemas.html", "/docs/platforms/databricks#create-the-schemas"],
    ["/docs/how-to/refresh-on-a-schedule", "/docs/platforms/databricks#schedule"],
    ["/docs/how-to/adf", "/docs/platforms/adf"],
    ["/docs/how-to/adf-native-connectors", "/docs/platforms/adf"],
    ["/docs/how-to/adf-runtime", "/docs/platforms/adf#runtime-and-key-vault"],
    ["/docs/how-to/publish-adf/", "/docs/platforms/adf#publish"],
    ["/docs/how-to/design-adf-pipelines", "/docs/platforms/adf-pipelines"],
    ["/docs/how-to/name-adf-resources", "/docs/platforms/adf-pipelines#name-resources"],
  ])
    assert.equal(shipped(from), to, from);
  assert.equal(
    shipped("/docs/how-to/adf-runtime?x=1"),
    "/docs/platforms/adf?x=1#runtime-and-key-vault",
  );
  // A path that only starts like a redirected one is not redirected.
  assert.equal(shipped("/docs/how-to/adf-runtimes"), undefined);
});

test("the guide and concept indexes, and the merged and moved guides, land on their pages", () => {
  const shipped = (path) => redirectFor(new URL(path, "https://docs.ingestron.io"));
  for (const [from, to] of [
    ["/docs/how-to", "/docs/how-to/start-from-a-template"],
    ["/docs/how-to/", "/docs/how-to/start-from-a-template"],
    ["/docs/concepts.html", "/docs/concepts/definitions"],
    ["/docs/how-to/use-an-example", "/docs/how-to/start-from-a-template#start-from-a-starter"],
    [
      "/docs/how-to/draft-a-contract-from-a-sample/",
      "/docs/how-to/write-a-contract#draft-from-a-sample",
    ],
  ])
    assert.equal(shipped(from), to, from);
  assert.equal(
    shipped("/docs/how-to/use-an-example?x=1"),
    "/docs/how-to/start-from-a-template?x=1#start-from-a-starter",
  );
  // A page inside a section that lost its index is not redirected.
  assert.equal(shipped("/docs/how-to/write-a-transform"), undefined);
  assert.equal(shipped("/docs/concepts/settings"), undefined);
});

test("the worked standard and the naming concept land on their guides", () => {
  const shipped = (path) => redirectFor(new URL(path, "https://docs.ingestron.io"));
  for (const [from, to] of [
    ["/docs/examples/organisation-standards", "/docs/how-to/configure-a-standard"],
    ["/docs/examples/organisation-standards/", "/docs/how-to/configure-a-standard"],
    ["/docs/concepts/naming", "/docs/how-to/name-things-your-way"],
    ["/docs/concepts/naming.html", "/docs/how-to/name-things-your-way"],
  ])
    assert.equal(shipped(from), to, from);
  assert.equal(shipped("/docs/concepts/naming?x=1"), "/docs/how-to/name-things-your-way?x=1");
  // The pages that took them in are not redirected, nor the new concept beside them.
  assert.equal(shipped("/docs/how-to/configure-a-standard"), undefined);
  assert.equal(shipped("/docs/concepts/layers"), undefined);
});

test("the worker answers the root with 307", () => {
  const response = redirectResponseFor(new URL("https://docs.ingestron.io/?q=1"));
  assert.deepEqual(response, { location: "https://docs.ingestron.io/docs?q=1", status: 307 });
});

test("the worker answers a mapped path with 301 and an absolute location", () => {
  const url = new URL("https://docs.ingestron.io/docs/a/?x=1");
  assert.deepEqual(redirectResponseFor(url, { redirects, patterns }), {
    location: "https://docs.ingestron.io/docs/b?x=1",
    status: 301,
  });
});

test("the worker passes an unknown path on to the assets", async () => {
  let asked;
  const env = {
    ASSETS: {
      fetch: async (request) => {
        asked = request.url;
        return new Response("ok");
      },
    },
  };
  const response = await worker.fetch(
    new Request("https://docs.ingestron.io/docs/start/install"),
    env,
  );
  assert.equal(asked, "https://docs.ingestron.io/docs/start/install");
  assert.equal(response.status, 200);
});

test("a connector's old chapters land on its page's sections, and categories on the catalogue", () => {
  const shipped = (path) => redirectFor(new URL(path, "https://docs.ingestron.io"));
  assert.equal(
    shipped("/docs/connectors/sqlserver/adf-connection"),
    "/docs/connectors/sqlserver#adf-connection",
  );
  assert.equal(
    shipped("/docs/connectors/sqlserver/databricks-ingestion/"),
    "/docs/connectors/sqlserver#databricks-ingestion",
  );
  assert.equal(
    shipped("/docs/connectors/amazon-s3/examples.html"),
    "/docs/connectors/amazon-s3#examples",
  );
  assert.equal(shipped("/docs/connectors/sap"), "/docs/connectors#sap");
  assert.equal(shipped("/docs/connectors/files-and-storage"), "/docs/connectors#files-and-storage");
  // A connector's page itself, and the catalogue, are not redirected.
  assert.equal(shipped("/docs/connectors/sqlserver"), undefined);
  assert.equal(shipped("/docs/connectors/sap-hana"), undefined);
  assert.equal(shipped("/docs/connectors"), undefined);
});
