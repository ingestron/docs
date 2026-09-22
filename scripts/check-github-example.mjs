/** Test the site's actual download through the public connector's synthetic harness. */
import {
  mkdirSync,
  cpSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const root = process.cwd(),
  work = resolve("build/github-example");
const commit = "a6deeeaaf4b394df93d327e985e5f34f555023c3";
// This checkout is disposable test output, never part of a user's project.
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const run = (args, cwd = work, env = process.env) =>
  execFileSync(args[0], args.slice(1), {
    cwd,
    env,
    stdio: "inherit",
    timeout: 1200000,
  });
run([
  "git",
  "clone",
  "--quiet",
  "https://github.com/ingestron/connectors.git",
  "connectors",
]);
const repo = resolve(work, "connectors");
run(["git", "checkout", "--detach", commit], repo);
const revision = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repo,
  encoding: "utf8",
}).trim();
assert.ok(revision === commit);
cpSync(
  resolve("public/examples/github/project.yaml"),
  resolve(repo, "examples/github/project.yaml"),
);
// Only the pinned Python harness is needed; use this site's published CLI.
// Do not install the connector repository's older development CLI.
run([process.execPath, "scripts/prepare-python.mjs"], repo);
run(
  ["build/singer-github/bin/python", "scripts/installed-acceptance.py"],
  repo,
  {
    ...process.env,
    INGESTRON_TEST_CLI: resolve(
      root,
      "node_modules/ingestron/build/cli/cli/index.js",
    ),
    INGESTRON_TEST_PUBLIC_SOURCE: "1",
  },
);
const evidence = JSON.parse(
  readFileSync(resolve(repo, "build/installed-acceptance/evidence.json")),
);
assert.equal(evidence.cli, "0.13.1");
assert.equal(evidence.core, "0.12.1");
assert.equal(evidence.liveGitHub, false);
// Run the reader's output-inspection download on the same produced file.
run(
  ["python3", resolve(root, "public/examples/github/inspect-output.py")],
  resolve(repo, "build/installed-acceptance"),
);
writeFileSync(
  resolve(work, "evidence.json"),
  JSON.stringify(
    {
      ...evidence,
      harnessCommit: revision,
      example: "public/examples/github/project.yaml",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Docs GitHub download: installed published packages, synthetic extraction and output inspection passed.",
);
