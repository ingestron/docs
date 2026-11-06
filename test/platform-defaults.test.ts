// A pack's platform defaults (components/reference/platform-defaults.tsx) come
// from the Platform document's descriptions, and the descriptions match what
// resolving a project gives.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadDefinitions } from "@ingestron/definitions";
import { PlatformDefaults } from "../components/reference/platform-defaults";
import { exampleFolder } from "../lib/examples";
import { adf } from "@ingestron/pack-adf";
import { databricks } from "@ingestron/pack-databricks";
import { packs, platformDefaults } from "../lib/reference";

/** The platform a sample resolves to in an environment. */
function platform(folder: string, environment: string) {
  const result = loadDefinitions(folder, { packs, environment });
  expect(result.ok, `${folder} (${environment})`).toBe(true);
  return result.model!.platform;
}

describe("platform defaults", () => {
  it("lists each field the Databricks pack reads, with its default, linked to its reference", () => {
    const rows = platformDefaults("databricks");
    expect(rows.map((row) => row.field.path.join("."))).toEqual([
      "mode",
      "compute.serverless",
      "schedule.timezone",
      "schedule.paused",
      "manage.schemas",
      "manage.tags",
      "manage.comments",
      "manage.checks",
    ]);
    const html = renderToStaticMarkup(createElement(PlatformDefaults, { pack: "databricks" }));
    expect(html).toContain(
      '<a href="/docs/reference/documents#platform-mode"><code>mode</code></a>',
    );
    expect(html).toContain(
      "development in an environment named dev, and production in every other, test and default included",
    );
    expect(html).toContain(
      "<td>running in an environment named prod or production, and where the platform sets mode: production itself; paused everywhere else, test included, though its mode is production by default</td>",
    );
    // Only fields whose description states a default: the pack also reads run_as, which has none.
    expect(databricks.platformFields).toContain("run_as");
  });

  it("lists only what the ADF pack reads, from its platformFields, and nothing for a pack that reads none", () => {
    expect(adf.platformFields).toEqual(["schedule.paused"]);
    // The ADF pack reads the platform's schedule.paused, never its mode.
    expect(platformDefaults("adf").map((row) => row.field.path.join("."))).toEqual([
      "schedule.paused",
    ]);
    expect(() => platformDefaults("synapse")).toThrow(
      "The synapse pack reads no platform defaults.",
    );
  });

  it("says what resolving a project with no settings gives", () => {
    // A project with no platform document, in a development and a production environment.
    const bare = mkdtempSync(join(tmpdir(), "docs-platform-defaults-"));
    cpSync(exampleFolder("minimal"), bare, { recursive: true });
    const project = join(bare, "project.yaml");
    writeFileSync(
      project,
      readFileSync(project, "utf8").replace("  dev: {}", "  dev: {}\n  prod: {}\n  production: {}"),
    );
    expect(platform(bare, "dev")).toMatchObject({
      mode: "development",
      compute: { serverless: true },
      manage: { schemas: false, tags: false, comments: false, checks: false },
    });
    expect(platform(bare, "prod").mode).toBe("production");
    expect(platform(bare, "production").mode).toBe("production");
    // Generated together, as the CLI does, every environment but dev is in production mode.
    const together = (environment: string) =>
      loadDefinitions(bare, { packs, environment, environmentsTogether: true }).model!.platform;
    writeFileSync(
      project,
      readFileSync(project, "utf8").replace("  dev: {}", "  dev: {}\n  test: {}"),
    );
    expect(together("dev").mode).toBe("development");
    expect(together("test").mode).toBe("production");
    // A schedule with only its cron runs in UTC, paused outside production.
    const scheduled = exampleFolder("platform-setup");
    expect(platform(scheduled, "dev").schedule).toMatchObject({ timezone: "UTC", paused: true });
    expect(platform(scheduled, "prod").schedule).toMatchObject({ timezone: "UTC", paused: false });
    const stated = Object.fromEntries(
      platformDefaults("databricks").map((row) => [row.field.path.join("."), row.default]),
    );
    expect(stated).toMatchObject({
      "compute.serverless": "true",
      "schedule.timezone": "UTC",
      "schedule.paused":
        "running in an environment named prod or production, and where the platform sets mode: production itself; paused everywhere else, test included, though its mode is production by default",
      "manage.tags": "false",
    });
  });
});
