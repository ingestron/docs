/** Exercise the immutable retail download using public source tags and npm CLI. */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = process.cwd(),
  work = resolve("build/files-example");
const commit = "61703515c2db7b1d992df8c0d189ecdda1a9b7e3";
const archiveSha =
  "8c6b4d8b5fa3cc14c28ca7346e34dc83f191dbff8b18e6f2874724a2791d2b9f";
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
  "https://github.com/ingestron/connectors/releases/download/files-1.0.1/retail-files-1.0.1.zip",
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
run(["python3", "scripts/files-acceptance.py"], repo, {
  ...process.env,
  INGESTRON_TEST_PUBLIC_SOURCE: "1",
  INGESTRON_TEST_RETAIL_ARCHIVE: archive,
  INGESTRON_TEST_CLI: resolve(
    root,
    "node_modules/ingestron/build/cli/cli/index.js",
  ),
});
const evidence = JSON.parse(
  readFileSync(resolve(repo, "build/files-acceptance/evidence.json")),
);
assert.equal(evidence.publicSource, true);
assert.equal(evidence.core, "0.12.2");
assert.equal(evidence.cli, "0.15.0");
writeFileSync(
  resolve(work, "evidence.json"),
  JSON.stringify({ ...evidence, archiveSha, harnessCommit: commit }, null, 2) +
    "\n",
);
console.log(
  "Published retail archive: all five formats and recovery checks passed.",
);
