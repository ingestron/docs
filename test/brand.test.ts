// The brand on the site: the lockup that suits each theme, the favicon for
// light and dark browsers, self-hosted fonts with their licences, and the
// colours each theme reads with.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { baseOptions } from "../lib/layout.shared";
import { rehypeBoxDrawing } from "../lib/rehype-box-drawing";

const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const bytes = (path: string) => readFileSync(join(process.cwd(), path));

/**
 * The brand's rendered files (SHA-256 of each file), so no logo, tile or font is
 * recoloured or redrawn here. The logos are the brand's files with only their
 * accessible title set to "Ingestron"; their drawing is unchanged.
 */
const brandFiles: Record<string, string> = {
  "public/brand/ingestron-lockup-primary.svg":
    "a68f94087d84899a7b1b4b3cfe3deedc203305157164cb50b024c651cb546458",
  "public/brand/ingestron-lockup-reverse.svg":
    "74b066e2d417da6acb35fdeb4940aa8ea9f83b0c11a3693f04bc1bc621c9277a",
  // The mark alone: primary for a light browser, reverse for a dark one.
  "public/favicon.svg": "9fee4041d74ff3a7637cd730bab5238b21aa1886685aa2bd4d8fb978de60f726",
  "public/favicon-dark.svg": "f2d5c60c5dbd23445c10fbd028efe1a1b77a1d770ca8ef93e7a924175c33da27",
  "public/fonts/manrope-variable.woff2":
    "a30ddcd349703aff7464c34bef3fffdff405ee50c113440d7c8693c02d210972",
  "public/fonts/jetbrains-mono-variable.woff2":
    "18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e",
};

/** Reads a UIntBase128 from a WOFF2 table directory. */
function base128(data: Buffer, at: { offset: number }): number {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = data[at.offset++]!;
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) return value;
  }
  throw new Error("bad UIntBase128");
}

/** The characters a WOFF2 font maps to a glyph, read from its cmap table. */
function woff2Characters(data: Buffer): Set<number> {
  expect(data.toString("latin1", 0, 4)).toBe("wOF2");
  const numTables = data.readUInt16BE(12);
  const at = { offset: 48 };
  const tables: { tag: number; length: number }[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = data[at.offset++]!;
    const tag = flags & 0x3f;
    if (tag === 63) at.offset += 4;
    const version = flags >> 6;
    const length = base128(data, at);
    // glyf (10) and loca (11) are transformed at version 0, other tables at any other.
    const transformed = tag === 10 || tag === 11 ? version === 0 : version !== 0;
    tables.push({ tag, length: transformed ? base128(data, at) : length });
  }
  const stream = brotliDecompressSync(data.subarray(at.offset));
  let offset = 0;
  let cmap: Buffer | undefined;
  for (const table of tables) {
    // cmap is table tag 0 and is never transformed.
    if (table.tag === 0) cmap = stream.subarray(offset, offset + table.length);
    offset += table.length;
  }
  const found = new Set<number>();
  for (let i = 0; i < cmap!.readUInt16BE(2); i++) {
    const sub = cmap!.subarray(cmap!.readUInt32BE(4 + i * 8 + 4));
    if (sub.readUInt16BE(0) === 12) {
      for (let g = 0; g < sub.readUInt32BE(12); g++) {
        const [start, end] = [sub.readUInt32BE(16 + g * 12), sub.readUInt32BE(20 + g * 12)];
        for (let code = start; code <= end; code++) found.add(code);
      }
    } else if (sub.readUInt16BE(0) === 4) {
      const segments = sub.readUInt16BE(6) / 2;
      for (let s = 0; s < segments; s++) {
        const end = sub.readUInt16BE(14 + s * 2);
        const start = sub.readUInt16BE(16 + segments * 2 + s * 2);
        if (start === 0xffff) continue;
        for (let code = start; code <= end; code++) found.add(code);
      }
    }
  }
  return found;
}

it("shows the primary lockup on paper and the reverse lockup on ink, at 96 px or wider", () => {
  const title = renderToStaticMarkup(
    createElement("div", null, baseOptions().nav!.title as ReactNode),
  );
  expect(title).toContain('class="docs-brand-light" src="/brand/ingestron-lockup-primary.svg"');
  expect(title).toContain('class="docs-brand-dark" src="/brand/ingestron-lockup-reverse.svg"');
  // The files' own titles are not the logo's name, so each image says it.
  expect(title.match(/alt="Ingestron"/g)).toHaveLength(2);
  for (const width of title.matchAll(/width="(\d+)"/g))
    expect(Number(width[1])).toBeGreaterThanOrEqual(96);
  const css = file("app/brand.css");
  expect(css).toContain(".dark .docs-brand .docs-brand-light {\n  display: none;");
  expect(css).toMatch(/\.docs-brand img \{[^}]*min-width: 96px;/);
});

it("serves the brand's logo, favicon and font files exactly as the brand issues them", () => {
  for (const [path, sha256] of Object.entries(brandFiles))
    expect(createHash("sha256").update(bytes(path)).digest("hex"), path).toBe(sha256);
});

it("draws DuckDB's boxes and the plan's arrows with JetBrains Mono, at the line height where they join", () => {
  const characters = woff2Characters(bytes("public/fonts/jetbrains-mono-box.woff2"));
  for (const character of "┌─┬┐│├┼┤└┴┘→")
    expect(characters.has(character.codePointAt(0)!), character).toBe(true);
  // Its source and licence are recorded beside it.
  const source = file("public/fonts/jetbrains-mono-box.txt");
  expect(source).toContain("JetBrains Mono 2.304");
  expect(source).toContain("releases/download/v2.304/JetBrainsMono-2.304.zip");
  expect(source).toContain("JetBrainsMono-OFL.txt");
  const css = file("app/brand.css");
  expect(css).toContain(
    'font-family: "Ingestron Box";\n  src: url("/fonts/jetbrains-mono-box.woff2")',
  );
  expect(css).not.toContain("local(");
  expect(css).toMatch(/\[data-box-drawing\] pre \{\n  line-height: 1\.32;/);
});

it("uses the Ingestron logo's mark as the favicon for light and dark browsers", () => {
  expect(existsSync(join(process.cwd(), "app/icon.svg"))).toBe(false);
  const layout = file("app/layout.tsx");
  expect(layout).toContain('url: "/favicon.svg"');
  expect(layout).toContain('url: "/favicon-dark.svg"');
  expect(layout).toContain('apple: "/apple-touch-icon.png"');
  for (const icon of ["favicon.svg", "favicon-dark.svg", "apple-touch-icon.png"])
    expect(existsSync(join(process.cwd(), "public", icon)), icon).toBe(true);
  // The earlier logo's files are gone.
  for (const old of [
    "brand/lockup-horizontal-primary.svg",
    "brand/lockup-horizontal-reverse.svg",
    "brand/mask-icon.svg",
  ])
    expect(existsSync(join(process.cwd(), "public", old)), old).toBe(false);
  expect(layout).not.toContain("mask-icon");
  // The touch icon is 180 px square.
  const png = bytes("public/apple-touch-icon.png");
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180]);
});

it("serves Manrope and JetBrains Mono itself, with their licences, and loads no third-party font", () => {
  const css = file("app/brand.css");
  for (const [family, font, licence] of [
    ["Manrope", "manrope-variable.woff2", "Manrope-OFL.txt"],
    ["JetBrains Mono", "jetbrains-mono-variable.woff2", "JetBrainsMono-OFL.txt"],
  ]) {
    expect(css).toContain(`font-family: "${family}";\n  src: url("/fonts/${font}")`);
    expect(existsSync(join(process.cwd(), "public/fonts", font)), font).toBe(true);
    expect(file(`public/fonts/${licence}`)).toContain("SIL Open Font License, Version 1.1");
  }
  expect(css).toMatch(/--font-sans: "Manrope"/);
  expect(css).toMatch(/--font-mono: "JetBrains Mono"/);
  for (const path of ["app/brand.css", "app/global.css", "app/layout.tsx"])
    expect(file(path), path).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
});

it("maps paper to the light theme and ink to the dark one, with signal deep and signal on dark for links", () => {
  const css = file("app/brand.css");
  const light = /:root \{([\s\S]*?)\n\}/.exec(css)![1]!;
  const dark = /\n\.dark \{([\s\S]*?)\n\}/.exec(css)![1]!;
  expect(light).toContain("--color-fd-background: var(--brand-paper);");
  expect(light).toContain("--docs-link: var(--brand-signal-deep);");
  expect(dark).toContain("--color-fd-background: var(--brand-ink);");
  expect(dark).toContain("--docs-link: var(--brand-signal-on-dark);");
  // No colour from the placeholder theme is left.
  for (const path of ["app/brand.css", "app/global.css", "app/content.css", "app/navigation.css"])
    expect(file(path), path).not.toMatch(/#096e63|#4fc2b3|#172b2b/i);
});

it("marks the code blocks that hold box-drawing characters, and only those", () => {
  const block = (line: string) => ({
    type: "element",
    tagName: "pre",
    properties: {},
    children: [{ type: "element", tagName: "code", children: [{ type: "text", value: line }] }],
  });
  const tree = { type: "root", children: [block("│ Aroha │ 2 │"), block("dev → build/dev")] };
  rehypeBoxDrawing()(tree);
  expect(tree.children.map((pre) => "dataBoxDrawing" in pre.properties)).toEqual([true, false]);
});
