// The screenshot frame (components/screenshot.tsx) in each of its forms, and
// the site's VS Code images: each one framed, captured in both themes, and used.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { checkedOn, Screenshot } from "../components/screenshot";
import { overflows } from "../lib/keyboard";
import { contentFolder } from "../lib/content-files.js";

const light = "/images/vscode/editor-light.png";
const dark = "/images/vscode/editor-dark.png";
const render = (props: Parameters<typeof Screenshot>[0]) =>
  renderToStaticMarkup(createElement(Screenshot, props));
const images = (html: string) => [...html.matchAll(/<img [^>]*>/g)].map(([tag]) => tag);
const pngWidth = (path: string) => readFileSync(join("public", path)).readUInt32BE(16);

describe("the screenshot frame", () => {
  it("shows a light and a dark capture, at the image's size, in a bar labelled VS Code", () => {
    const html = render({ light, dark, caption: "The editor.", alt: "A flow in the editor." });
    const [first, second] = images(html);
    expect(images(html)).toHaveLength(2);
    expect(first).toContain('class="screenshot-light"');
    expect(first).toContain(`src="${light}"`);
    expect(second).toContain('class="screenshot-dark"');
    expect(second).toContain(`src="${dark}"`);
    expect(first).toContain(`width="${pngWidth(light)}"`);
    expect(first).toContain('alt="A flow in the editor."');
    expect(html).toContain('<span class="screenshot-label">VS Code · Ingestron</span>');
    expect(html).toContain('role="region"');
    // The frame is named after the shot, and is a tab stop until the page
    // finds that nothing scrolls.
    expect(html).toMatch(
      /<div class="screenshot-scroll" role="region" aria-label="A flow in the editor." tabindex="0">/,
    );
    expect(html).toContain("<figcaption>The editor.</figcaption>");
  });

  it("shows a platform's single capture in both themes, under its own label", () => {
    const html = render({ src: light, label: "Azure Data Factory", caption: "The pipeline." });
    expect(images(html)).toHaveLength(1);
    expect(images(html)[0]).not.toContain("class=");
    expect(images(html)[0]).toContain('alt="The pipeline."');
    expect(html).toContain('<span class="screenshot-label">Azure Data Factory</span>');
    expect(html).toContain('aria-label="The pipeline."');
  });

  it("ends the caption with the date the screen was checked", () => {
    const html = render({ src: light, caption: "The pipeline.", checked: "2026-11-04" });
    expect(html).toContain("<figcaption>The pipeline. Checked on 4 November 2026.</figcaption>");
    expect(checkedOn("2027-01-31")).toBe("31 January 2027");
    expect(() => checkedOn("4 November 2026")).toThrow(/checked must be a date/);
    expect(() => checkedOn("2026-13-01")).toThrow(/checked must be a date/);
    expect(() => checkedOn("2026-02-31")).toThrow(/checked must be a date/);
    expect(() => checkedOn("2026-02-29")).toThrow(/checked must be a date/);
    expect(checkedOn("2028-02-29")).toBe("29 February 2028");
  });

  it("refuses captures that do not fit together", () => {
    expect(() => render({ src: light, light, dark, caption: "x" } as never)).toThrow(/not both/);
    expect(() => render({ light, caption: "x" } as never)).toThrow(/both light and dark/);
    expect(() => render({ light, dark: "/images/vscode/check-dark.png", caption: "x" })).toThrow(
      /differ in size/,
    );
    expect(() => render({ src: "/images/vscode/missing.png", caption: "x" })).toThrow();
  });
});

describe("the screenshot's scrolling frame", () => {
  it("is a tab stop only while the image is wider than the frame", () => {
    expect(overflows({ scrollWidth: 640, clientWidth: 358 })).toBe(true);
    expect(overflows({ scrollWidth: 684, clientWidth: 684 })).toBe(false);
    expect(overflows({ scrollWidth: 685, clientWidth: 684 })).toBe(false);
  });

  it("checks again when it is mounted, when an image loads and when it changes size", () => {
    const source = readFileSync("components/screenshot-scroll.tsx", "utf8");
    for (const text of [
      '"use client"',
      "overflows(element)",
      'addEventListener("load", check)',
      "new ResizeObserver(check)",
      "tabIndex={scrolls ? 0 : undefined}",
      'role="region"',
      "aria-label={label}",
    ])
      expect(source).toContain(text);
    expect(readFileSync("components/screenshot.tsx", "utf8")).toContain(
      "<ScreenshotScroll label={alt ?? caption}>",
    );
  });
});

describe("the VS Code screenshots", () => {
  const pages = (folder: string): string[] =>
    readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? pages(join(folder, entry.name))
        : entry.name.endsWith(".mdx")
          ? [readFileSync(join(folder, entry.name), "utf8")]
          : [],
    );
  const site = pages(contentFolder).join("\n");
  const files = readdirSync("public/images/vscode");

  it("are all framed", () => {
    expect(site).not.toMatch(/!\[[^\]]*\]\(\/images\//);
    expect(site).not.toMatch(/<img /);
  });

  it("each come in both themes, 1600 pixels wide, and a page uses every one", () => {
    const names = new Set(files.map((file) => file.replace(/-(light|dark)\.png$/, "")));
    for (const name of names) {
      for (const theme of ["light", "dark"]) {
        const path = `/images/vscode/${name}-${theme}.png`;
        expect(files, path).toContain(`${name}-${theme}.png`);
        expect(pngWidth(path), path).toBe(1600);
      }
      expect(site, name).toContain(`light="/images/vscode/${name}-light.png"`);
      expect(site, name).toContain(`dark="/images/vscode/${name}-dark.png"`);
    }
  });
});
