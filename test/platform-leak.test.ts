// A platform's docs name no other platform, in prose, YAML, commands, outputs,
// alt text or links; a combination's name only its two platforms
// (specs/2026-11-16-docs-combined-sites-design.md). The counting is in
// test/leaks.ts; `pnpm tsx test/leaks.ts <page>` prints a page's leaking lines.
// The built pages' components are checked by scripts/check-links.ts.
import { describe, expect, it } from "vitest";
import { mentions } from "./leaks.js";

describe("site pages", () => {
  it("name only the platforms their site is for", () => {
    const found = Object.entries(mentions()).map(
      ([file, counts]) =>
        `${file}: ${Object.entries(counts)
          .map(([other, count]) => `${other} ×${count}`)
          .join(", ")}`,
    );
    expect(found).toEqual([]);
  });
});
