// The platform picker lists the platforms, then a line and the combinations
// under "Combined" (specs/2026-11-16-docs-combined-sites-design.md).
import { describe, expect, it } from "vitest";
import { pickerGroups } from "../lib/platforms.js";

const ids = (groups: ReturnType<typeof pickerGroups>) =>
  groups.map((group) => [group.label, group.separated, group.items.map((item) => item.id)]);

describe("pickerGroups", () => {
  it("lists the platforms, then the combinations after a line", () => {
    expect(ids(pickerGroups(""))).toEqual([
      ["Platforms", false, ["synapse", "databricks", "adf", "duckdb"]],
      ["Combined", true, ["adf-databricks", "adf-synapse", "adf-duckdb"]],
    ]);
  });

  it("filters both groups, and leaves out a group with nothing left", () => {
    expect(ids(pickerGroups("synapse"))).toEqual([
      ["Platforms", false, ["synapse"]],
      ["Combined", true, ["adf-synapse"]],
    ]);
    expect(ids(pickerGroups("duck"))).toEqual([
      ["Platforms", false, ["duckdb"]],
      ["Combined", true, ["adf-duckdb"]],
    ]);
    expect(ids(pickerGroups("into"))).toEqual([
      ["Combined", true, ["adf-databricks", "adf-synapse", "adf-duckdb"]],
    ]);
    expect(pickerGroups("nothing like it")).toEqual([]);
  });
});
