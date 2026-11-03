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
