// The brand on the site: the lockup that suits each theme, the favicon for
// light and dark browsers, self-hosted fonts with their licences, and the
// colours each theme reads with.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { baseOptions } from "../lib/layout.shared";

const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

it("shows the primary lockup on paper and the reverse lockup on ink, at 96 px or wider", () => {
  const title = renderToStaticMarkup(
    createElement("div", null, baseOptions().nav!.title as ReactNode),
  );
  expect(title).toContain('class="docs-brand-light" src="/brand/lockup-horizontal-primary.svg"');
  expect(title).toContain('class="docs-brand-dark" src="/brand/lockup-horizontal-reverse.svg"');
  for (const width of title.matchAll(/width="(\d+)"/g))
    expect(Number(width[1])).toBeGreaterThanOrEqual(96);
  const css = file("app/brand.css");
  expect(css).toContain(".dark .docs-brand .docs-brand-light {\n  display: none;");
  expect(css).toMatch(/\.docs-brand img \{[^}]*min-width: 96px;/);
  // The signal tile keeps the brand's colour in every file the site serves.
  for (const svg of ["brand/lockup-horizontal-primary.svg", "brand/lockup-horizontal-reverse.svg"])
    expect(file(`public/${svg}`)).toContain('fill="#FF4B23"');
});

it("replaces the placeholder icon with the brand favicon for light and dark browsers", () => {
  expect(existsSync(join(process.cwd(), "app/icon.svg"))).toBe(false);
  const layout = file("app/layout.tsx");
  expect(layout).toContain('url: "/favicon.svg"');
  expect(layout).toContain('url: "/favicon-dark.svg"');
  expect(layout).toContain('apple: "/apple-touch-icon.png"');
  for (const icon of [
    "favicon.svg",
    "favicon-dark.svg",
    "apple-touch-icon.png",
    "brand/mask-icon.svg",
  ])
    expect(existsSync(join(process.cwd(), "public", icon)), icon).toBe(true);
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
