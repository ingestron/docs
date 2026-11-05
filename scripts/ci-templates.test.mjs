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

test("each check template installs ingestron 2 from npm, then runs ingestron check", () => {
  for (const file of [...checks, "github-actions/deploy.yml", "azure-devops/azure-pipelines.yml"]) {
    const text = read(file);
    assert.match(
      text,
      /(run|script): npm install -g ingestron@2\n[\s\S]*(run|script): ingestron check\n/,
      file,
    );
    assert.doesNotMatch(text, /npx|pnpm|node packages\//, file);
  }
});

test("each check template installs Node 22", () => {
  assert.match(read(checks[0]), /actions\/setup-node@v4[\s\S]*node-version: 22/);
  assert.match(read(checks[1]), /NodeTool@0[\s\S]*versionSpec: 22\.x/);
});

test("GitHub Actions: one build, deployed to dev, then test, then prod, each in its environment", () => {
  const deploy = yaml("github-actions/deploy.yml");
  assert.deepEqual(deploy.on, { push: { branches: ["main"] } });
  assert.deepEqual(deploy.permissions, { contents: "read", "id-token": "write" });
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
  }
  const upload = steps(deploy).find((step) => step.uses?.startsWith("actions/upload-artifact@"));
  assert.match(upload.with.path, /arm\/\nbuild\//);

  const environment = yaml("github-actions/deploy-environment.yml");
  assert.ok(environment.on.workflow_call.inputs.environment.required);
  const job = environment.jobs.deploy;
  assert.equal(job.environment, "${{ inputs.environment }}");
  assert.equal(job.concurrency.group, "deploy-${{ inputs.environment }}");
  assert.equal(job.concurrency["cancel-in-progress"], false);
  const uses = steps(environment).map((step) => step.uses);
  assert.ok(uses.includes("actions/download-artifact@v4"));
  assert.ok(uses.includes("azure/login@v2"));
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
    assert.match(text, /node "\$adf" validate build\/adf\/factory /, file);
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
  assert.ok(steps(github).some((step) => step.uses === "databricks/setup-cli@v1.23.0"));
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
