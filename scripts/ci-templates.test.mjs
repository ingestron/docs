// The CI templates run the published CLI, not this repository's build.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (file) => readFileSync(join(import.meta.dirname, "../ci-templates", file), "utf8");
const templates = ["github-actions/ingestron-check.yml", "azure-devops/ingestron-check.yml"];

test("each template installs ingestron from npm, then runs ingestron check", () => {
  for (const file of templates) {
    const text = read(file);
    assert.match(
      text,
      /(run|script): npm install -g ingestron@1\n[\s\S]*(run|script): ingestron check\n/,
      file,
    );
    assert.doesNotMatch(text, /npx/, file);
    assert.doesNotMatch(text, /pnpm|node packages\//, file);
  }
});

test("each template installs Node 22", () => {
  assert.match(read(templates[0]), /actions\/setup-node@v4[\s\S]*node-version: 22/);
  assert.match(read(templates[1]), /NodeTool@0[\s\S]*versionSpec: 22\.x/);
});

test("the DuckDB job template pulls the public runner image with no registry", () => {
  const text = read("azure/duckdb-job.bicep");
  assert.match(text, /param image string = 'ghcr\.io\/ingestron\/duckdb-runner:1'/);
  assert.match(text, /replicaRetryLimit: 1/);
  assert.match(text, /INGESTRON_SQL/);
  const code = text.split("\n").filter((line) => !line.trim().startsWith("//"));
  assert.doesNotMatch(code.join("\n"), /registries:/);
});
