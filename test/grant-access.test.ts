// "Grant access, mask columns and filter rows", run as the page shows it: each
// output it quotes comes from planning a copy of the example it names, changed
// as the page says, and the examples it shows plan with nothing to warn about.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readExampleFile } from "../lib/examples.js";
import { cli, copy, fences, read, section } from "./pages.js";

const page = read("how-to/grant-access.mdx");

/** Changes one file of a copy of an example, failing when the text to change is not there. */
function change(cwd: string, file: string, from: string, to: string): void {
  const path = join(cwd, file);
  const text = readFileSync(path, "utf8");
  expect(text, `${file} holds ${from}`).toContain(from);
  writeFileSync(path, text.replace(from, to));
}

describe("how-to/grant-access", () => {
  it("shows examples that grant, mask and filter with nothing to warn about", () => {
    for (const name of ["governed-databricks", "synapse-views"]) {
      const { code, output } = cli(copy(name), ["plan", "--no-diff"]);
      expect(code, output).toBe(0);
      expect(output, name).not.toContain("CAPABILITY_OFF");
      expect(output, name).not.toContain("NOT_APPLIED");
    }
    const task = readExampleFile(
      "governed-databricks",
      "build/databricks/tasks/shop/apply_contract.py",
    );
    for (const policy of [
      "ingestron_mask_confidential",
      "ingestron_mask_restricted",
      "ingestron_filter_region_rows",
    ])
      expect(task).toContain(`"name": "${policy}"`);
  });

  it("quotes the warning a role gives while grants are off", () => {
    const cwd = copy("governed-databricks");
    change(cwd, "platform.yaml", "    grants: true", "    grants: false");
    const [warning] = fences(section(page, "## Turn grants on"), "text");
    const { code, output } = cli(cwd, ["plan", "--no-diff"]);
    expect(code).toBe(0);
    expect(output).toContain(warning!);
  });

  it("quotes the error a text mask gives on a column that is not text", () => {
    const cwd = copy("governed-databricks");
    change(
      cwd,
      "contracts/customers.yaml",
      "primaryKey: true, classification: internal",
      "primaryKey: true, classification: confidential",
    );
    const [error] = fences(section(page, "## Mask sensitive columns"), "text");
    const { code, output } = cli(cwd, ["plan", "--no-diff"]);
    expect(code).toBe(1);
    expect(output).toContain(error!);
  });

  it("quotes the warning a mask gives on Synapse", () => {
    const cwd = copy("synapse-views");
    change(
      cwd,
      "contracts/customers.yaml",
      "{ name: name, logicalType: string }",
      "{ name: name, logicalType: string, classification: confidential }",
    );
    writeFileSync(
      join(cwd, "standard.yaml"),
      `${readFileSync(join(cwd, "standard.yaml"), "utf8")}governance:\n  masks: { confidential: hash }\n`,
    );
    const [warning] = fences(section(page, "## On Synapse"), "text");
    const { code, output } = cli(cwd, ["plan", "--no-diff"]);
    expect(code).toBe(0);
    expect(output).toContain(warning!);
  });

  it("accepts the role DuckDB cannot grant, and the passport still says so", () => {
    const { code, output } = cli(copy("data-products"), ["plan", "--no-diff"]);
    expect(code).toBe(0);
    expect(output).toContain("1 accepted warning (platform.yaml)");
    expect(output).not.toContain("NOT_APPLIED");
    expect(readExampleFile("data-products", "build/products/dev/customers.md")).toContain(
      "Not enforced on DuckDB: DuckDB has no access control.",
    );
  });
});
