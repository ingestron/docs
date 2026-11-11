// Published standards (kits), intent and the field reference's help: the pages
// show what the packages and the installed kits hold, and what the CLI prints.
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { documentReference, intentPaths, intentUseOf } from "@ingestron/definitions";
import { FieldTable, PlatformSection } from "../components/reference/document-fields";
import { KitFacts, KitIntent, KitList } from "../components/reference/kits";
import {
  IntentAliases,
  IntentOverview,
  IntentSupport,
  QualityEngines,
  ZonesNotApplied,
  IntentVocabulary,
} from "../components/reference/pack-intent";
import { kitBlanks, kitById, kitPage, kits, latestKits } from "../lib/kits";
import {
  fieldPath,
  intentRows,
  intentVocabulary,
  packs,
  platformSectionFields,
} from "../lib/reference";
import { cli, fences, read, section } from "./pages.js";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

// No test reaches the network: the catalogue is a repository that is not there.
let saved: string | undefined;
beforeAll(() => {
  saved = process.env.INGESTRON_STANDARDS_REPOSITORY;
  process.env.INGESTRON_STANDARDS_REPOSITORY = `file://${join(tmpdir(), "no-such-catalogue.git")}`;
});
afterAll(() => {
  if (saved === undefined) delete process.env.INGESTRON_STANDARDS_REPOSITORY;
  else process.env.INGESTRON_STANDARDS_REPOSITORY = saved;
});

describe("the field reference's help", () => {
  it("shows where to find a value and a suggestion, where a field has them", () => {
    const field = platformSectionFields("databricks").find(
      (item) => fieldPath(item) === "databricks.run_as.service_principal_name",
    )!;
    expect(field.find).toBeTruthy();
    expect(field.suggest).toBe("<application id>");
    const shown = html(createElement(FieldTable, { label: "x", fields: [field] }));
    expect(shown).toContain("Where to find it: Settings, then Identity and access");
    expect(shown).toContain("Suggested: <code>&lt;application id&gt;</code>");
    // A document's field too: an alert's address.
    const to = documentReference("Platform").find((item) => fieldPath(item) === "alerts.*.to.*")!;
    expect(html(createElement(FieldTable, { label: "x", fields: [to] }))).toContain(
      "Suggested: <code>&lt;team&gt;@&lt;domain&gt;</code>",
    );
  });

  it("gives each field of the Databricks section its anchor on the pack's page", () => {
    const page = read("reference/packs/databricks.mdx");
    expect(page).toContain('<PlatformSection pack="databricks" />');
    const shown = html(createElement(PlatformSection, { pack: "databricks" }));
    for (const field of platformSectionFields("databricks")) {
      const [path, anchor] = field.docs.split("#");
      expect(path).toBe("/docs/reference/packs/databricks");
      expect(shown).toContain(`id="${anchor}"`);
    }
  });
});

describe("intent", () => {
  it("has a support matrix on every pack's page, from the pack's own coverage", () => {
    for (const pack of packs) {
      expect(read(`reference/packs/${pack.id}.mdx`)).toContain(
        `## Intent [#intent]\n\nWhat this pack does with each value of [intent](/docs/reference/intent)`,
      );
      expect(read(`reference/packs/${pack.id}.mdx`)).toContain(
        `<IntentSupport pack="${pack.id}" />`,
      );
      // Every value of every path, each covered once.
      const rows = intentRows(pack.id);
      expect(rows.flatMap((row) => row.values.map((value) => `${row.path}=${value}`))).toEqual(
        Object.entries(intentPaths).flatMap(([path, values]) =>
          values.map((value) => `${path}=${value}`),
        ),
      );
    }
    const databricks = html(createElement(IntentSupport, { pack: "databricks" }));
    // A preview feature shows its release level, linked to the page, and the date checked.
    const slow = intentUseOf(packs[0]!, "operations.alerts", "slow");
    expect(slow?.use === "used" && slow.status?.level).toBe("preview");
    expect(databricks).toContain(">Public Preview</a>");
    expect(databricks).toContain(">Generally available</a>");
    expect(databricks).toContain("<td>2026-11-09</td>");
    // Where a method differs from its pack.
    expect(databricks).toContain("Managed ingestion reads the source, not files.");
  });

  it("has a quality and cleansing section on every pack's page, apart from the rest of intent", () => {
    for (const pack of packs) {
      const page = read(`reference/packs/${pack.id}.mdx`);
      expect(page).toContain("## Quality and cleansing [#quality-and-cleansing]");
      expect(page).toContain(`<IntentSupport pack="${pack.id}" part="quality" />`);
      const quality = html(createElement(IntentSupport, { pack: pack.id, part: "quality" }));
      const rest = html(createElement(IntentSupport, { pack: pack.id }));
      expect(quality).toContain("<code>quality.rules</code>");
      expect(quality).toContain("<code>cleanse.timezone</code>");
      expect(quality).not.toContain("<code>history</code>");
      expect(rest).toContain("<code>history</code>");
      expect(rest).not.toContain("<code>quality.rules</code>");
    }
    // Where a pack applies a value only in some layers, and the zones it cannot convert.
    const duckdb = html(createElement(IntentSupport, { pack: "duckdb", part: "quality" }));
    expect(duckdb).toContain("Only in a layer whose <code>does</code> lists <code>check</code>");
    expect(read("reference/packs/synapse.mdx")).toContain('<ZonesNotApplied pack="synapse" />');
    const zones = html(createElement(ZonesNotApplied, { pack: "synapse" }));
    const use = intentUseOf(
      packs.find((pack) => pack.id === "synapse")!,
      "cleanse.timezone",
      "true",
    );
    const listed = Object.keys((use?.use === "used" && use.zonesNotApplied) || {});
    expect(listed).toContain("Antarctica/Troll");
    for (const zone of listed) expect(zones).toContain(`<code>${zone}</code>`);
    expect(() => html(createElement(ZonesNotApplied, { pack: "duckdb" }))).toThrow();
    // The engine table: what each engine does, or why it does not.
    const engines = html(createElement(QualityEngines));
    expect(engines).toContain("Not applied: a view can&#x27;t stop a load");
    expect(engines).toContain("ON VIOLATION DROP ROW");
  });

  it("describes every intent path, and shows every pack's use of each value", () => {
    const vocabulary = intentVocabulary();
    expect(vocabulary.map((row) => row.path)).toEqual(Object.keys(intentPaths));
    const history = vocabulary.find((row) => row.path === "history")!;
    expect(history.places).toEqual(["layer", "flow", "flow table", "transform"]);
    expect(vocabulary.find((row) => row.path === "load.cursor")!.places).toEqual([
      "flow",
      "flow table",
    ]);
    // The checks a contract gives, and the cleansing each table writes for its columns.
    const placesOf = (path: string) => vocabulary.find((row) => row.path === path)!.places;
    expect(placesOf("quality.rules")).toEqual(["contract"]);
    expect(placesOf("quality.table-checks")).toEqual(["contract"]);
    expect(placesOf("quality.actions")).toEqual(["standard", "layer", "flow table", "transform"]);
    expect(placesOf("quality.quarantine")).toEqual([
      "standard",
      "layer",
      "flow table",
      "transform",
    ]);
    expect(placesOf("cleanse.trim")).toEqual(["standard", "flow table", "transform"]);
    expect(placesOf("cleanse.map")).toEqual(["flow table", "transform"]);
    expect(placesOf("deduplicate")).toEqual(["flow table", "transform"]);
    const page = read("reference/intent.mdx");
    for (const component of ["<IntentVocabulary />", "<IntentOverview />", "<IntentAliases />"])
      expect(page).toContain(component);
    const described = html(createElement(IntentVocabulary));
    expect(described).toContain("Only the latest row per key.");
    expect(described).toContain("Matches a regular expression");
    const overview = html(createElement(IntentOverview));
    for (const pack of packs) expect(overview).toContain(`/docs/reference/packs/${pack.id}#intent`);
    expect(html(createElement(IntentAliases))).toContain(
      "<code>mode: upsert</code> is <code>history: latest</code>",
    );
  });
});

describe("published standards", () => {
  it("has a page for each installed kit, titled as the kit, with its current version", () => {
    expect(latestKits().map((kit) => kit.id)).toEqual([
      "databricks/lakehouse-streaming",
      "duckdb/local-medallion",
    ]);
    const list = html(createElement(KitList));
    for (const kit of latestKits()) {
      const path = `${kitPage(kit.id).replace("/docs/", "")}.mdx`;
      const page = read(path);
      expect(page).toContain(`title: ${kit.title}\n`);
      expect(page).toContain(`<KitFacts id="${kit.id}" />`);
      expect(fences(page, "sh")).toEqual([`ingestron init shop --kit ${kit.id}@${kit.version}\n`]);
      expect(list).toContain(`href="${kitPage(kit.id)}"`);
      expect(html(createElement(KitFacts, { id: kit.id }))).toContain(kit.summary);
    }
    expect(kits().every((kit) => kit.features === "ga")).toBe(true);
  });

  it("explains every REPLACE_ME of each kit with the field reference the hover uses", () => {
    for (const kit of latestKits())
      for (const file of ["platform.yaml", "project.yaml"]) {
        for (const blank of kitBlanks(kit, file)) {
          expect(blank.help, `${kit.id} ${file} ${blank.pointer}`).toBeDefined();
          expect(blank.help!.find, `${kit.id} ${file} ${blank.pointer}`).toBeTruthy();
          expect(blank.help!.suggest, `${kit.id} ${file} ${blank.pointer}`).toBeTruthy();
        }
      }
    const kit = kitById("databricks/lakehouse-streaming");
    expect(kitBlanks(kit, "platform.yaml").map((blank) => [blank.line, blank.help!.field])).toEqual(
      [
        [12, "to"],
        [15, "principals"],
        [21, "service_principal_name"],
        [34, "functions"],
      ],
    );
    // Each permission group is a project.yaml value of its own, explained by the field that reads it.
    expect(
      kitBlanks(kit, "project.yaml")
        .filter((blank) => blank.help!.field === "group_name")
        .map((blank) => blank.line),
    ).toEqual([5, 7]);
    // Each kit page shows the files that hold them.
    const page = read(`${kitPage(kit.id).replace("/docs/", "")}.mdx`);
    for (const file of ["platform.yaml", "project.yaml"])
      expect(page).toContain(`<KitFile id="${kit.id}" file="${file}" />`);
  });

  it("shows where each table's intent came from", () => {
    const shown = html(createElement(KitIntent, { id: "databricks/lakehouse-streaming" }));
    expect(shown).toContain("<code>silver.orders</code>");
    expect(shown).toContain("<code>history: latest</code>");
    expect(shown).toContain("the table&#x27;s layer in the standard (standard.yaml:");
    expect(shown).toContain("this table (flows/orders.yaml:");
    expect(shown).toContain("the pack&#x27;s default");
  });

  it("prints what Start from a published standard shows", () => {
    const page = read("how-to/start-from-a-published-standard.mdx");
    const create = section(page, "## Create the project");
    const [command] = fences(create, "sh");
    expect(command).toBe("ingestron init shop --kit duckdb/local-medallion@2026-11-10\n");
    const cwd = mkdtempSync(join(tmpdir(), "docs-kit-"));
    const { code, output } = cli(cwd, command!.trim().split(" ").slice(1));
    expect(code).toBe(0);
    expect(output).toBe(fences(create, "text")[0]);
    // The name alone, with the catalogue out of reach: the newest installed version, and a note.
    const alone = cli(cwd, ["init", "alone", "--kit", "duckdb/local-medallion"]);
    expect(alone.code).toBe(0);
    const [note] = alone.output.split("\n");
    expect(note).toBe(
      "Could not reach the catalogue; using the newest installed version, duckdb/local-medallion@2026-11-10.",
    );
    expect(create).toContain(`\`${note}\``);
    const connection = section(page, "## With a connection [#with-a-connection]");
    const [warning] = fences(connection, "text");
    const sales = cli(cwd, [
      "init",
      "sales",
      "--kit",
      "databricks/lakehouse-streaming@2026-11-10",
      "--connector",
      "sqlserver",
      "--connectivity",
      "public",
      "--via",
      "databricks",
      "--yes",
    ]);
    expect(sales.code).toBe(0);
    expect(sales.output).toContain(warning!.trimEnd());
  });

  it("prints what Choose a published standard and Move to a newer one show", () => {
    const cwd = mkdtempSync(join(tmpdir(), "docs-kit-"));
    expect(cli(cwd, ["init", "p", "--kit", "duckdb/local-medallion@2026-11-10"]).code).toBe(0);
    const project = join(cwd, "p");
    const git = (...args: string[]) =>
      execFileSync("git", args, {
        cwd: project,
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "t",
          GIT_AUTHOR_EMAIL: "t@example.com",
          GIT_COMMITTER_NAME: "t",
          GIT_COMMITTER_EMAIL: "t@example.com",
        },
      });
    git("init", "-q");
    git("add", "-A");
    git("commit", "-qm", "init");

    const choose = read("how-to/choose-a-published-standard.mdx");
    const listed = cli(project, ["standard", "list"]);
    expect(listed.code).toBe(0);
    const reached = "Could not reach the catalogue; showing the kits installed with ingestron.\n";
    expect(listed.output.startsWith(reached)).toBe(true);
    expect(choose).toContain(`\`${reached.trim()}\``);
    expect(listed.output.slice(reached.length)).toBe(
      fences(section(choose, "## List them"), "text")[0],
    );

    const upgrade = read("how-to/upgrade-a-standard.mdx");
    const [refused, printed] = fences(upgrade, "text");
    const install = cli(project, ["standard", "install", "duckdb/local-medallion@2026-11-10"]);
    expect(install.code).toBe(0);
    expect(install.output).toBe(printed);
    // The new file is what the project had: the same version.
    expect(git("status", "--porcelain").toString()).toBe("");
    // A standard with changes that are not committed is refused.
    const standard = join(project, "standard.yaml");
    appendFileSync(standard, "# a change\n");
    const stopped = cli(project, ["standard", "install", "duckdb/local-medallion@2026-11-10"]);
    expect(stopped.code).toBe(1);
    expect(stopped.output).toBe(refused);
    expect(readFileSync(standard, "utf8").endsWith("# a change\n")).toBe(true);
  });
});
