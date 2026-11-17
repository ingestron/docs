// The flow-triggers example: a flow's own triggers, the standard's rules and the errors its page shows.
import { describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { run } from "@ingestron/cli";
import { exampleFolder, readExampleFile } from "../lib/examples.js";
import { sharedFolder } from "../lib/content-files.js";
import { ErrorCodes, OutputFolderProblems } from "../components/reference/error-codes";

const copy = () => {
  const cwd = mkdtempSync(join(tmpdir(), "docs-flow-triggers-"));
  cpSync(exampleFolder("flow-triggers-adf-databricks"), cwd, { recursive: true });
  return cwd;
};
const plan = (cwd: string) => {
  let output = "";
  const code = run(["plan"], { cwd, write: (text) => (output += text) });
  return { code, output };
};
const page = () =>
  readFileSync(join(sharedFolder, "guides/run-a-flow-on-its-own-triggers.mdx"), "utf8");

describe("the flow-triggers example", () => {
  it("plans with no problems, and writes a trigger for each of the flow's triggers", () => {
    const { code, output } = plan(copy());
    expect(output).not.toContain("error");
    expect(output).not.toContain("NOT_APPLIED");
    expect(code).toBe(0);
    const hourly = JSON.parse(
      readExampleFile(
        "flow-triggers-adf-databricks",
        "build/adf/factory/trigger/tr_erp_erp_erp_hourly_h1.json",
      ),
    );
    expect(hourly.properties.type).toBe("TumblingWindowTrigger");
    expect(hourly.properties.annotations).toContain("ingestron:backfill");
    const weekly = JSON.parse(
      readExampleFile(
        "flow-triggers-adf-databricks",
        "build/adf/factory/trigger/tr_erp_erp_erp_weekly-reload.json",
      ),
    );
    expect(weekly.properties.type).toBe("ScheduleTrigger");
    expect(weekly.properties.typeProperties.recurrence.timeZone).toBe("GMT Standard Time");
    expect(weekly.properties.pipelines[0].parameters.load).toBe("full");
  });

  it("reads min_date in the invoices query as an escaped date, never raw text", () => {
    const pipeline = JSON.parse(
      readExampleFile(
        "flow-triggers-adf-databricks",
        "build/adf/factory/pipeline/pl_erp_erp_erp.json",
      ),
    );
    const query: string =
      pipeline.properties.activities[1].typeProperties.source.sqlReaderQuery.value;
    expect(query).toContain("formatDateTime(pipeline().parameters.min_date, 'yyyy-MM-dd')");
    expect(pipeline.properties.parameters.min_date.defaultValue).toBe("2020-01-01");
  });

  it("refuses a start inside prod's backup hours with the output its page shows", () => {
    const cwd = copy();
    const flow = join(cwd, "flows/erp.yaml");
    const text = readFileSync(flow, "utf8").replace(
      "hours: [3], minutes: [0]",
      "hours: [2], minutes: [30]",
    );
    writeFileSync(flow, text);
    const shown = /```text\n(prod: the definitions have problems[\s\S]*?)```/.exec(page())?.[1];
    const { code, output } = plan(cwd);
    expect(code).toBe(1);
    expect(output.replace(/\n\nexit.*$/, "").trimEnd()).toBe(shown?.trimEnd());
  });

  it("stops a new tumbling window that starts in the past, unless it confirms the backfill", () => {
    const cwd = copy();
    const flow = join(cwd, "flows/erp.yaml");
    const text = readFileSync(flow, "utf8")
      .replace(/ +backfill: true\n/, "")
      .replace("start: 2026-12-01T00:00:00Z", "start: 2026-01-01T00:00:00Z");
    writeFileSync(flow, text);
    const { code, output } = plan(cwd);
    expect(code).toBe(1);
    expect(output).toContain("FIRST_WRITE");
    expect(output).toContain("or write `backfill: true` on the trigger");
  });

  it("refuses a table with no primary key, naming the table", () => {
    const cwd = copy();
    const contract = join(cwd, "contracts/invoices.yaml");
    writeFileSync(contract, readFileSync(contract, "utf8").replace("primaryKey: true", ""));
    const { code, output } = plan(cwd);
    expect(code).toBe(1);
    expect(output).toContain("TRIGGER_KEY");
    expect(output).toContain("invoices, which has no primary key");
  });
});

describe("the error reference", () => {
  it("lists every code of flow triggers, and the plan's FIRST_WRITE, each with its fix", () => {
    const shown =
      renderToStaticMarkup(createElement(ErrorCodes)) +
      renderToStaticMarkup(createElement(OutputFolderProblems));
    for (const code of [
      "TRIGGER_NOT_ALLOWED",
      "TRIGGER_PARAMETER",
      "TRIGGER_OPTION",
      "TRIGGER_HOURS",
      "TRIGGER_LOOKBACK",
      "TRIGGER_KEY",
      "FILTER_NOT_SUPPORTED",
      "FIRST_WRITE",
    ]) {
      const entry = shown.slice(shown.indexOf(`id="${code}"`));
      expect(entry.startsWith("id="), code).toBe(true);
      expect(entry.slice(0, entry.indexOf("</section>")), code).toContain("<strong>Fix:</strong>");
    }
  });
});
