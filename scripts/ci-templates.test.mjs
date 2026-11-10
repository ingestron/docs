// The CI templates: each parses, runs the published CLI rather than this
// repository's build, promotes one build through dev, test and prod, and names
// every tool it downloads by an exact version, checked where it can be.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { parse } from "yaml";

const folder = join(import.meta.dirname, "../ci-templates");
const read = (file) => readFileSync(join(folder, file), "utf8");
const yaml = (file) => parse(read(file));
const checks = ["github-actions/ingestron-check.yml", "azure-devops/ingestron-check.yml"];
const deploys = [
  "github-actions/deploy.yml",
  "github-actions/deploy-environment.yml",
  "azure-devops/azure-pipelines.yml",
  "azure-devops/templates/deploy-environment.yml",
];

/** Every step of a GitHub workflow or Azure DevOps pipeline, wherever it is nested. */
function steps(node) {
  if (Array.isArray(node)) return node.flatMap(steps);
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === "steps" && Array.isArray(value) ? [...value, ...steps(value)] : steps(value),
  );
}

/** The text a step runs: a GitHub `run`, an Azure DevOps `script` or `bash`, or an inline script. */
const scripts = (file) =>
  steps(yaml(file))
    .map(
      (step) =>
        step.run ??
        step.script ??
        step.bash ??
        step.with?.inlineScript ??
        step.inputs?.inlineScript ??
        step.inputs?.ScriptArguments ??
        "",
    )
    .join("\n");

test("every YAML template parses, and the folder holds no other kind of file", () => {
  const files = (path) =>
    readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(join(path, entry.name))
        : [relative(folder, join(path, entry.name))],
    );
  const all = files(folder).sort();
  assert.deepEqual(all, [...checks, ...deploys, "azure/duckdb-job.bicep"].sort());
  for (const file of [...checks, ...deploys]) assert.equal(typeof yaml(file), "object", file);
});

/**
 * The ingestron bundle the templates install: an exact version, the one the
 * docs build with (test/standards-and-teams.test.ts checks the cli's version).
 */
const bundle = "2.3.0";

test("each check installs an exact ingestron from npm, then runs ingestron check", () => {
  for (const file of [...checks, "github-actions/deploy.yml", "azure-devops/azure-pipelines.yml"]) {
    const text = read(file);
    assert.match(
      text,
      new RegExp(
        `(run|script): npm install -g ingestron@${bundle.replaceAll(".", "\\.")}\\n[\\s\\S]*(run|script): ingestron check\\n`,
      ),
      file,
    );
    assert.doesNotMatch(text, /ingestron@\d+\n/, file);
    assert.doesNotMatch(text, /npx|pnpm|node packages\//, file);
  }
});

test("each check template installs Node 22", () => {
  assert.match(
    read(checks[0]),
    /actions\/setup-node@[0-9a-f]{40} # v7\.1\.0\n\s+with:\n\s+node-version: 22/,
  );
  assert.match(read(checks[1]), /UseNode@1\n\s+inputs:\n\s+version: 22\.x/);
});

test("GitHub Actions: one build, deployed to dev, then test, then prod, each in its environment", () => {
  const deploy = yaml("github-actions/deploy.yml");
  assert.deepEqual(deploy.on, { push: { branches: ["main"] } });
  // Only the deploy jobs get an OIDC token.
  assert.deepEqual(deploy.permissions, { contents: "read" });
  assert.equal(deploy.jobs.build.needs, "check");
  const order = [
    ["dev", "build"],
    ["test", "dev"],
    ["prod", "test"],
  ];
  for (const [environment, after] of order) {
    const job = deploy.jobs[environment];
    assert.equal(job.needs, after, environment);
    assert.equal(job.uses, "./.github/workflows/deploy-environment.yml", environment);
    assert.deepEqual(job.with, { environment }, environment);
    assert.deepEqual(job.permissions, { contents: "read", "id-token": "write" }, environment);
  }
  const upload = steps(deploy).find((step) => step.uses?.startsWith("actions/upload-artifact@"));
  assert.match(upload.with.path, /arm\/\nbuild\//);

  const environment = yaml("github-actions/deploy-environment.yml");
  assert.ok(environment.on.workflow_call.inputs.environment.required);
  const job = environment.jobs.deploy;
  assert.equal(job.environment, "${{ inputs.environment }}");
  assert.equal(job.concurrency.group, "deploy-${{ inputs.environment }}");
  assert.equal(job.concurrency["cancel-in-progress"], false);
  const uses = steps(environment).map((step) => step.uses?.split("@")[0]);
  assert.ok(uses.includes("actions/download-artifact"));
  assert.ok(uses.includes("azure/login"));
  assert.ok(!steps(environment).some((step) => step.uses?.startsWith("actions/checkout")));
});

test("Azure DevOps: one Build stage, deployed to dev, then test, then prod, each in its environment", () => {
  const pipeline = yaml("azure-devops/azure-pipelines.yml");
  assert.deepEqual(pipeline.trigger, { branches: { include: ["main"] } });
  assert.equal(pipeline.pr, "none");
  const [build, ...stages] = pipeline.stages;
  assert.equal(build.stage, "Build");
  assert.ok(steps(build).some((step) => step.task === "PublishPipelineArtifact@1"));
  assert.deepEqual(
    stages.map((stage) => [stage.parameters.environment, stage.parameters.dependsOn]),
    [
      ["dev", "Build"],
      ["test", "Deploy_dev"],
      ["prod", "Deploy_test"],
    ],
  );
  for (const stage of stages) assert.equal(stage.template, "templates/deploy-environment.yml");

  const template = yaml("azure-devops/templates/deploy-environment.yml");
  const [stage] = template.stages;
  assert.equal(stage.stage, "Deploy_${{ parameters.environment }}");
  // With the environment's exclusive lock check, runs deploy one at a time, in order.
  assert.equal(stage.lockBehavior, "sequential");
  assert.match(read("azure-devops/azure-pipelines.yml"), /exclusive lock check/);
  const [deployment] = stage.jobs;
  assert.equal(deployment.environment, "${{ parameters.environment }}");
  const tasks = steps(template).map((step) => step.task);
  for (const task of [
    "AzurePowerShell@5",
    "AzureResourceManagerTemplateDeployment@3",
    "AzureCLI@2",
  ])
    assert.ok(tasks.includes(task), task);
  const arm = steps(template).find(
    (step) => step.task === "AzureResourceManagerTemplateDeployment@3",
  );
  assert.equal(arm.inputs.deploymentMode, "Incremental");
  for (const script of steps(template).filter((step) => step.task === "AzurePowerShell@5"))
    assert.equal(script.inputs.pwsh, true);
});

test("Data Factory: built once with Microsoft's package 1.0.3, deployed incrementally with each environment's parameters", () => {
  for (const file of ["github-actions/deploy.yml", "azure-devops/azure-pipelines.yml"]) {
    const text = scripts(file);
    assert.match(
      text,
      /npm install --prefix \S+ @microsoft\/azure-data-factory-utilities@1\.0\.3\n/,
    );
    // The export validates too, so there is no separate validate run.
    assert.doesNotMatch(text, /node "\$adf" validate/, file);
    assert.match(text, /node "\$adf" export build\/adf\/factory \S+ arm\n/, file);
  }
  const github = scripts("github-actions/deploy-environment.yml");
  assert.match(github, /--mode Incremental/);
  assert.match(github, /--parameters "@build\/adf\/parameters\/\$ENVIRONMENT\.json" factoryName=/);
  for (const file of [
    "github-actions/deploy-environment.yml",
    "azure-devops/templates/deploy-environment.yml",
  ]) {
    const text = scripts(file);
    // The pre- and post-deployment script read each environment's parameters, or prod's triggers stay stopped.
    assert.equal(
      text.match(/-ArmTemplateParameters \S*build\/adf\/parameters\//g)?.length,
      2,
      file,
    );
    assert.match(text, /-PreDeployment \$true -DeleteDeployment \$false/, file);
    assert.match(text, /-PreDeployment \$false -DeleteDeployment \$true/, file);
  }
});

test("Databricks: CLI v1.23.0, checked by its SHA-256 where it is downloaded, deploying each environment's target", () => {
  const github = yaml("github-actions/deploy-environment.yml");
  assert.ok(
    steps(github).some((step) =>
      step.uses?.startsWith("databricks/setup-cli@9625fdde9ba2607df0087e0d3ec7449198bf2180"),
    ),
  );
  assert.match(
    read("github-actions/deploy-environment.yml"),
    /databricks\/setup-cli@[0-9a-f]{40} # v1\.23\.0\n/,
  );
  const deploy = steps(github).find((step) => step.name === "Databricks: deploy the bundle");
  assert.equal(deploy["working-directory"], "build/databricks");
  assert.equal(deploy.env.DATABRICKS_AUTH_TYPE, "github-oidc");
  assert.match(
    deploy.run,
    /databricks bundle validate -t "\$ENVIRONMENT"\ndatabricks bundle deploy -t "\$ENVIRONMENT"/,
  );

  const devops = scripts("azure-devops/templates/deploy-environment.yml");
  assert.match(
    devops,
    /releases\/download\/v1\.23\.0\/databricks_cli_1\.23\.0_linux_amd64\.tar\.gz\n.*echo "a5ec088f7f6cc5974327a42df99261e22fbc6f7ca9cddb945333c238dd9e2289 .*" \| sha256sum -c -/,
  );
  assert.match(devops, /databricks bundle deploy -t \$\{\{ parameters\.environment \}\}/);
  const cli = steps(yaml("azure-devops/templates/deploy-environment.yml")).find(
    (step) => step.displayName === "Databricks: deploy the bundle",
  );
  assert.equal(cli.env.DATABRICKS_AUTH_TYPE, "azure-cli");
  // Microsoft Learn: required, so databricks bundle's subprocesses see the session.
  for (const step of steps(yaml("azure-devops/templates/deploy-environment.yml")).filter(
    (found) => found.task === "AzureCLI@2",
  ))
    assert.equal(step.inputs.useGlobalConfig, true, step.displayName);
});

test("Synapse: sqlcmd (Go) v1.10.0, checked by its SHA-256, run from build/synapse", () => {
  for (const file of [
    "github-actions/deploy-environment.yml",
    "azure-devops/templates/deploy-environment.yml",
  ]) {
    const text = scripts(file);
    assert.match(
      text,
      /go-sqlcmd\/releases\/download\/v1\.10\.0\/sqlcmd-linux-amd64\.tar\.bz2\necho "92516d98c63d99b0994de5b61350c91f6915f9b76f139a59039fbcb225c2e987 .*" \| sha256sum -c -/,
      file,
    );
    assert.match(
      text,
      /sqlcmd -S "\S+" --authentication-method ActiveDirectoryDefault\s+-i "?environments\//,
      file,
    );
    assert.doesNotMatch(text, / -[xX] /, file);
  }
  const step = steps(yaml("github-actions/deploy-environment.yml")).find(
    (found) => found.name === "Synapse: create or alter the views",
  );
  assert.equal(step["working-directory"], "build/synapse");
  const task = steps(yaml("azure-devops/templates/deploy-environment.yml")).find(
    (found) => found.displayName === "Synapse: create or alter the views",
  );
  assert.equal(task.inputs.workingDirectory, "$(files)/build/synapse");
});

test("every GitHub action is pinned to a full commit SHA, with the version it is", () => {
  // The majors these templates were checked against, so a bump is deliberate.
  const expected = {
    "actions/checkout": "v7.0.1",
    "actions/setup-node": "v7.1.0",
    "actions/upload-artifact": "v7.0.2",
    "actions/download-artifact": "v8.0.2",
    "azure/login": "v3.1.0",
    "azure/powershell": "v3.0.0",
    "databricks/setup-cli": "v1.23.0",
  };
  const seen = new Set();
  for (const file of [checks[0], deploys[0], deploys[1]])
    for (const line of read(file).split("\n")) {
      const found = /^\s*-?\s*uses: (\S+)(.*)$/.exec(line);
      if (!found || found[1].startsWith("./")) continue;
      const [name, ref] = found[1].split("@");
      assert.match(ref, /^[0-9a-f]{40}$/, `${file}: ${line.trim()}`);
      assert.equal(found[2], ` # ${expected[name]}`, `${file}: ${name}`);
      seen.add(name);
    }
  assert.deepEqual([...seen].sort(), Object.keys(expected).sort());
});

test("no deploy step installs or runs Ingestron", () => {
  for (const file of [
    "github-actions/deploy-environment.yml",
    "azure-devops/templates/deploy-environment.yml",
  ])
    assert.doesNotMatch(read(file), /ingestron (check|apply|plan)|npm install -g ingestron/, file);
});

test("the DuckDB job template pulls the public runner image with no registry", () => {
  const text = read("azure/duckdb-job.bicep");
  assert.match(text, /param image string = 'ghcr\.io\/ingestron\/duckdb-runner:1'/);
  assert.match(text, /replicaRetryLimit: 1/);
  assert.match(text, /INGESTRON_SQL/);
  const code = text.split("\n").filter((line) => !line.trim().startsWith("//"));
  assert.doesNotMatch(code.join("\n"), /registries:/);
});
