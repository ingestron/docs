import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { parse } from "yaml";
const root = resolve("content/docs");
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)],
  );
const pages = walk(root).filter((p) => p.endsWith(".mdx"));
const routes = new Set(
  pages
    .map(
      (p) =>
        "/docs/" +
        relative(root, p)
          .replace(/\.mdx$/, "")
          .replace(/(^|\/)index$/, ""),
    )
    .map((s) => s.replace(/\/$/, "")),
);
test("page metadata and local links are valid", () => {
  for (const p of pages) {
    const text = readFileSync(p, "utf8");
    assert.match(text, /^---\ntitle: .+\ndescription: .+\n---/);
    const body = text.replace(/```[\s\S]*?```/g, "");
    for (const [, url] of [
      ...body.matchAll(/\]\(([^)]+)\)/g),
      ...body.matchAll(/href="([^"]+)"/g),
    ]) {
      const path = url.split("#")[0];
      if (path.startsWith("/docs"))
        assert.ok(routes.has(path), `${p}: ${path}`);
      else if (path.startsWith("/"))
        assert.ok(existsSync(resolve("public", "." + path)), `${p}: ${path}`);
    }
  }
});
test("navigation covers every page and retired content is absent", () => {
  const listed = new Set();
  for (const p of walk(root).filter((p) => p.endsWith("meta.json"))) {
    const m = JSON.parse(readFileSync(p));
    for (const name of m.pages) {
      const file = resolve(dirname(p), name + ".mdx");
      assert.ok(
        existsSync(file) || existsSync(resolve(dirname(p), name, "meta.json")),
        file,
      );
      if (existsSync(file)) {
        assert.ok(!listed.has(file));
        listed.add(file);
      }
    }
  }
  assert.deepEqual([...listed].sort(), pages.sort());
  for (const p of pages)
    assert.doesNotMatch(
      readFileSync(p, "utf8"),
      /api\.ingestron\.io|jobs\.ingestron\.io|ingestron-io\/|@ingestron\/contracts/,
    );
  assert.ok(!existsSync("vendor"));
  assert.ok(!existsSync("public/integrations"));
});
test("downloads match tutorial versions, projection and inline metadata", () => {
  const p = parse(readFileSync("public/examples/github/project.yaml", "utf8"));
  assert.equal(p.providers.packages.local, "ingestron/provider-local@0.4.1");
  assert.equal(
    p.providers.packages.github,
    "ingestron/connectors/connectors/github/connector.yaml@1.33.0",
  );
  assert.equal(p.connections.github.settings.authentication, "anonymous");
  assert.deepEqual(
    p.flows[0].tables.issues.contract.schema[0].properties.map((p) => p.name),
    ["id", "title"],
  );
  const guide = readFileSync(
    "content/docs/tutorials/github-to-parquet.mdx",
    "utf8",
  );
  for (const command of [
    "plugin install local@0.4.1",
    "plugin install github@1.33.0",
    "run --action review",
    "run --action approve",
    "run --retry issues-001",
  ])
    assert.ok(guide.includes(command), command);
  const first = readFileSync("content/docs/start/first-contract.mdx", "utf8");
  assert.deepEqual(
    JSON.parse(first.match(/```json\n([\s\S]*?)```/)[1]),
    JSON.parse(readFileSync("public/examples/contracts/metadata.json")),
  );
  assert.match(
    readFileSync("public/examples/github/gitignore.txt", "utf8"),
    /\.env/,
  );
});

test("retail guide selects the immutable package and tested workflow", () => {
  const guide = readFileSync("content/docs/tutorials/retail-files.mdx", "utf8");
  for (const step of [
    "retail-files-1.0.0.zip",
    "python3 setup.py",
    "run --action review",
    "run --action approve",
    "python3 inspect-output.py",
    "run --retry rejected-001",
  ])
    assert.ok(guide.includes(step));
  assert.ok(guide.includes("61.95"));
});
