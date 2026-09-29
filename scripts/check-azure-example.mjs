/** Exercise the immutable retail download using public source tags and npm CLI. */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = process.cwd(),
  work = resolve("build/azure-example");
const commit = "17db40c5bce109b08fc8a9250da9376c622c964c";
const archiveSha =
  "4686bc0e59a125fb1466b88f3bfe5b5264f66b61fc657db6b9aeb2c2e1e4c599";
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
  "https://github.com/ingestron/connectors/releases/download/azure-blob-1.1.0/azure-blob-retail-1.1.0.zip",
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
assert.equal(evidence.core, "0.12.12");
assert.equal(evidence.cli, "0.17.6");
writeFileSync(
  resolve(work, "evidence.json"),
  JSON.stringify({ ...evidence, archiveSha, harnessCommit: commit }, null, 2) +
    "\n",
);
console.log(
  "Published Azure retail archive: all five formats and recovery checks passed.",
);
