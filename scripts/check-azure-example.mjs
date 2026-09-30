/** Exercise the immutable retail download using public source tags and npm CLI. */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = process.cwd(),
  work = resolve("build/azure-example");
const commit = "884c5b62a821e43b5508ffb43deddb33671d2721";
const archiveSha =
  "c647a220be9790bb2be799ccb5cc2956fd8114ec0144ffa52d91e726456b5348";
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
  "https://github.com/ingestron/connectors/releases/download/azure-blob-2.0.0/azure-blob-retail-2.0.0.zip",
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
// The harness needs only locked Python dependencies, not the connector JS dev package.
run(["node", "scripts/prepare-python.mjs"], repo);
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
assert.equal(evidence.core, "0.12.14");
assert.equal(evidence.cli, "0.17.8");
writeFileSync(
  resolve(work, "evidence.json"),
  JSON.stringify({ ...evidence, archiveSha, harnessCommit: commit }, null, 2) +
    "\n",
);
console.log(
  "Published Azure retail archive: all five formats and recovery checks passed.",
);
