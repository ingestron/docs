// The mark on <html data-site> that shows a platform's tabs follows every
// page change, not only a full page load: the page's platform, else the one
// chosen last, else none.
import { describe, expect, it } from "vitest";
import { siteMark } from "../lib/platforms.js";

describe("siteMark", () => {
  it("is the page's platform, else the remembered one, else none", () => {
    expect(siteMark("/docs/databricks/deploy", "synapse")).toBe("databricks");
    expect(siteMark("/docs/concepts/definitions", "synapse")).toBe("synapse");
    expect(siteMark("/docs/concepts/definitions", undefined)).toBeUndefined();
    expect(siteMark("/docs", "duckdb")).toBe("duckdb");
  });
});
