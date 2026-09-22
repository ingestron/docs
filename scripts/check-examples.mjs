import { mkdtempSync, cpSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const cli = resolve("node_modules/ingestron/build/cli/cli/index.js");
const work = mkdtempSync(resolve(tmpdir(), "ingestron-docs-example-"));
function run(project, args, ok = true) {
  const p = spawnSync(
    process.execPath,
    [cli, "--project", project, "--json", "--no-input", ...args],
    { encoding: "utf8", timeout: 120000 },
  );
  const result = JSON.parse(p.stdout);
  assert.equal(result.ok, ok, JSON.stringify(result));
  return result;
}
try {
  run(work, ["init", "retail"]);
  const root = resolve(work, "retail");
  run(root, ["--dry-run", "source", "add", "customers", "--type", "csv"]);
  run(root, ["source", "add", "customers", "--type", "csv"]);
  cpSync(
    "public/examples/contracts/metadata.json",
    resolve(root, "metadata.json"),
  );
  run(root, ["source", "import", "customers", "--metadata", "metadata.json"]);
  run(root, ["contract", "draft", "customers", "--source", "customers"]);
  run(root, ["contract", "check", "customers"]);
  run(root, ["check", "--draft"]);
  const file = resolve(root, "contracts/customers.odcs.yaml"),
    before = readFileSync(file, "utf8");
  run(root, ["contract", "draft", "customers", "--source", "customers"], false);
  assert.equal(readFileSync(file, "utf8"), before);
  console.log(
    "Published CLI: downloaded metadata, contract draft, validation and overwrite protection passed.",
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
