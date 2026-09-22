/** Exercise the immutable retail download using public source tags and npm CLI. */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = process.cwd(),
  work = resolve("build/azure-example");
const commit = "920d2cf5d8e9c2117331cea1ffb6bd8730b19fb7";
const archiveSha =
  "6072581a644ff345cba214ce86337b12e44b7e10a205ca63e83c2fdb7cc891aa";
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const run = (args, cwd = work, env = process.env) =>
  execFileSync(args[0], args.slice(1), {
    cwd,
    env,
    stdio: "inherit",
    timeout: 1200000,
  });
const archive = resolve(work, "retail.zip");
run([
  "curl",
  "--fail",
  "--location",
  "--output",
  archive,
  "https://github.com/ingestron/connectors/releases/download/azure-blob-1.0.0/azure-blob-retail-1.0.0.zip",
]);
assert.equal(
  createHash("sha256").update(readFileSync(archive)).digest("hex"),
  archiveSha,
);
run([
  "git",
  "clone",
  "--quiet",
  "https://github.com/ingestron/connectors.git",
  "connectors",
]);
const repo = resolve(work, "connectors");
run(["git", "checkout", "--detach", commit], repo);
run(["pnpm", "install", "--frozen-lockfile"], repo);
run(["pnpm", "runtime:prepare"], repo);
run(
  ["build/singer-github/bin/python", "scripts/azure-blob-acceptance.py"],
  repo,
  {
    ...process.env,
    INGESTRON_TEST_PUBLIC_SOURCE: "1",
    INGESTRON_TEST_RETAIL_ARCHIVE: archive,
    INGESTRON_TEST_CLI: resolve(
      root,
      "node_modules/ingestron/build/cli/cli/index.js",
    ),
  },
);
const evidence = JSON.parse(
  readFileSync(resolve(repo, "build/azure-blob-acceptance/evidence.json")),
);
assert.equal(evidence.publicSource, true);
assert.equal(evidence.core, "0.12.1");
assert.equal(evidence.cli, "0.14.0");
writeFileSync(
  resolve(work, "evidence.json"),
  JSON.stringify({ ...evidence, archiveSha, harnessCommit: commit }, null, 2) +
    "\n",
);
console.log(
  "Published Azure retail archive: all five formats and recovery checks passed.",
);
