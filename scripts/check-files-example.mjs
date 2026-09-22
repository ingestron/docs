/** Exercise the immutable retail download using public source tags and npm CLI. */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = process.cwd(),
  work = resolve("build/files-example");
const commit = "6c4a522c55936e4cba43cef044be64e23320cbda";
const archiveSha =
  "50f8fc3c8602f75139b407edf2daead32821c9abae03ec2a1bbf27d1cc5b12a2";
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
  "https://github.com/ingestron/connectors/releases/download/files-1.0.0/retail-files-1.0.0.zip",
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
assert.equal(evidence.core, "0.12.1");
writeFileSync(
  resolve(work, "evidence.json"),
  JSON.stringify({ ...evidence, archiveSha, harnessCommit: commit }, null, 2) +
    "\n",
);
console.log(
  "Published retail archive: all five formats and recovery checks passed.",
);
