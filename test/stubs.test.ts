// One source, many copies: a page that several platforms show is one file in
// content/shared/, and each platform's copy is a stub that only includes it.
// A stub with its own text would drift from the others, so it fails here; so
// does platform-only text on a page that every platform shares.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentFolder } from "../lib/content-files.js";
import { isStub } from "../lib/platform-text.js";
import { ownPages, platformIds, platformOfPath, sharedPageNamed } from "../lib/platforms.js";

const pages = readdirSync(contentFolder, { recursive: true, encoding: "utf8" })
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => file.endsWith(".mdx"));
const name = (file: string) =>
  file
    .split("/")
    .at(-1)!
    .replace(/\.mdx$/, "");

describe("isStub", () => {
  it("accepts front matter and one include, and nothing else", () => {
    const stub =
      "---\ntitle: A\ndescription: B.\n---\n\n<include>../../../shared/guides/a.mdx</include>\n";
    expect(isStub(stub)).toBe(true);
    expect(isStub(`${stub}\nMore text.\n`)).toBe(false);
    expect(isStub(stub.replace("<include>", "Intro.\n\n<include>"))).toBe(false);
    expect(isStub(`${stub}<include>../../../shared/guides/b.mdx</include>\n`)).toBe(false);
    expect(isStub("---\ntitle: A\n---\n\nText.\n")).toBe(false);
  });
});

describe("platform pages", () => {
  it("are stubs of a shared file, or a page only that platform has", () => {
    for (const file of pages.filter((file) => platformOfPath(file))) {
      const id = platformOfPath(file)!;
      const text = readFileSync(join(contentFolder, file), "utf8");
      if (sharedPageNamed(name(file)) && !file.includes("/connectors/"))
        expect(isStub(text), `${file} must only include its shared file`).toBe(true);
      else if (!file.includes("/connectors/"))
        expect(
          Object.values(ownPages[id]).flat(),
          `${file} is neither a stub nor one of ${id}'s own pages`,
        ).toContain(name(file));
      if (text.includes("content/shared") || text.includes("/shared/"))
        expect(isStub(text), file).toBe(true);
    }
  });

  it('are the only pages with <Only> or platform="~"', () => {
    for (const file of pages.filter((file) => !platformOfPath(file))) {
      const text = readFileSync(join(contentFolder, file), "utf8");
      expect(text, file).not.toContain("<Only");
      expect(text, file).not.toContain('platform="~"');
    }
    expect(platformIds.length).toBeGreaterThan(0);
  });
});

describe("shared files", () => {
  it("open and close each block <Only> at the same indent, so it stays in one list item or none", () => {
    const shared = join(contentFolder, "..", "shared");
    const files = readdirSync(shared, { recursive: true, encoding: "utf8" }).filter((file) =>
      file.endsWith(".mdx"),
    );
    const broken: string[] = [];
    for (const file of files) {
      const stack: { indent: number; line: number }[] = [];
      readFileSync(join(shared, file), "utf8")
        .split("\n")
        .forEach((text, index) => {
          const open = /^( *)<Only on="[^"]*">\s*$/.exec(text);
          const close = /^( *)<\/Only>\s*$/.exec(text);
          if (open) stack.push({ indent: open[1]!.length, line: index + 1 });
          if (close) {
            const opened = stack.pop();
            if (opened && opened.indent !== close[1]!.length)
              broken.push(
                `${file}:${opened.line} opens at ${opened.indent}, closes at ${close[1]!.length} on ${index + 1}`,
              );
          }
        });
    }
    expect(broken).toEqual([]);
  });
});
