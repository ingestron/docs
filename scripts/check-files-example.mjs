/** Recreate both retail tutorials from the published download and shown YAML. */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { parse, stringify } from "yaml";

const site = process.cwd();
const work = resolve("build/files-example");
const cli = resolve("node_modules/ingestron/build/cli/cli/index.js");
const archiveSha =
  "286eb5f22a2bb4e4208016de953adfec1332dd994d126d8579b335fb7859559e";
const archiveUrl =
  "https://github.com/ingestron/connectors/releases/download/retail-1.1.0/retail-files-1.1.0.zip";
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const run = (args, cwd = work) => {
  try {
    return execFileSync(args[0], args.slice(1), {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 1200000,
    });
  } catch (error) {
    console.error(error.stdout?.slice(-2000), error.stderr?.slice(-2000));
    throw error;
  }
};
const archive = resolve(work, "retail.zip");
const localArchive = process.env.INGESTRON_TEST_RETAIL_ARCHIVE;
if (localArchive) copyFileSync(localArchive, archive);
else run(["curl", "--fail", "--location", "--output", archive, archiveUrl]);
const actualSha = createHash("sha256")
  .update(readFileSync(archive))
  .digest("hex");
assert.equal(actualSha, process.env.INGESTRON_TEST_RETAIL_SHA256 ?? archiveSha);
const exercise = resolve(work, "retail");
mkdirSync(exercise);
run(["python3", "-m", "zipfile", "-e", archive, exercise]);
const projectDir = resolve(exercise, "my-retail-flow");
mkdirSync(resolve(projectDir, "contracts"), { recursive: true });
const snippets = (path) =>
  [
    ...readFileSync(resolve(site, path), "utf8").matchAll(
      /```yaml\n([\s\S]*?)\n```/g,
    ),
  ].map((match) => match[1] + "\n");
const first = snippets("content/docs/tutorials/retail-files.mdx");
assert.equal(first.length, 4, "project and three contract snippets");
let project = first[0];
for (const name of ["customers", "products", "orders"]) {
  project = project.replaceAll(
    `__${name.toUpperCase()}_PATH__`,
    resolve(exercise, "data/csv", `${name}.csv`),
  );
}
project = project.replaceAll("__FORMAT__", "csv");
writeFileSync(resolve(projectDir, "project.yaml"), project);
for (const [index, name] of ["customers", "products", "orders"].entries()) {
  writeFileSync(
    resolve(projectDir, `contracts/${name}.odcs.yaml`),
    first[index + 1],
  );
  assert.equal(
    first[index + 1],
    readFileSync(resolve(exercise, `contracts/${name}.odcs.yaml`), "utf8"),
  );
}
assert.equal(
  first[0],
  readFileSync(resolve(exercise, "project.template.yaml"), "utf8"),
);
const command = (...args) =>
  run(["node", cli, "--json", "--no-input", ...args], projectDir);
command("provider", "install", "local@0.4.1");
command("connector", "install", "files@1.1.0");
command("check");
command("build");
command("runtime", "prepare");
command("run", "--action", "discover");
command("run", "--action", "review");
command("run", "--action", "approve");
command("run", "--run-id", "retail-001");
command("run", "status", "retail-001");
copyFileSync(
  resolve(exercise, "inspect-output.py"),
  resolve(projectDir, "inspect-output.py"),
);
run(["python3", "inspect-output.py"], projectDir);
command("run", "--retry", "retail-001");

const second = snippets("content/docs/tutorials/retail-add-table.mdx");
assert.equal(second.length, 2, "inventory table and contract snippets");
const addition = parse(second[0]);
assert.deepEqual(Object.keys(addition), ["inventory"]);
const updated = parse(project);
updated.flows[0].tables.inventory = addition.inventory;
updated.flows[0].tables.inventory.source.path = resolve(
  exercise,
  "data/csv/inventory.csv",
);
writeFileSync(resolve(projectDir, "project.yaml"), stringify(updated));
writeFileSync(resolve(projectDir, "contracts/inventory.odcs.yaml"), second[1]);
command("check");
command("build", "--out", "build/retail-v2");
command("runtime", "prepare", "--from", "build/retail-v2");
command("run", "--from", "build/retail-v2", "--action", "discover");
command("run", "--from", "build/retail-v2", "--action", "review");
command("run", "--from", "build/retail-v2", "--action", "approve");
command("run", "--from", "build/retail-v2", "--run-id", "retail-002");
command("run", "--from", "build/retail-v2", "status", "retail-002");
const dataDir = resolve(projectDir, "build/retail-v2/data/retail_local");
const identities = readdirSync(dataDir);
assert.equal(identities.length, 1);
const committed = resolve(dataDir, identities[0], "retail-002");
assert.deepEqual(
  readdirSync(committed)
    .filter((name) => name.endsWith(".parquet"))
    .sort(),
  [
    "customers.parquet",
    "inventory.parquet",
    "orders.parquet",
    "products.parquet",
  ],
);
writeFileSync(
  resolve(work, "evidence.json"),
  JSON.stringify(
    {
      archiveSha256: actualSha,
      cli: "0.15.1",
      files: "1.1.0",
      authoredFromTutorial: true,
      initialTables: 3,
      updatedTables: 4,
      reviewedBothBuilds: true,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Published retail tutorial: manual project and four-table update passed.",
);
