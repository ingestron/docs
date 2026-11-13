// The four kinds of code block: what each block is, by its fence and path, how
// that reads on the real pages, what each kind shows, and the contrast of its
// text in both themes.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KindBlock } from "../components/code-block";
import {
  blockKind,
  exampleKind,
  startsCommand,
  transformerBlockKind,
  type BlockKind,
} from "../lib/block-kind";
import { contentFolder } from "../lib/content-files.js";

const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** Every page's fenced blocks: language, meta string, title and body. */
function pageFences() {
  const pages = (folder: string): string[] =>
    readdirSync(folder).flatMap((name) => {
      const path = join(folder, name);
      return statSync(path).isDirectory() ? pages(path) : path.endsWith(".mdx") ? [path] : [];
    });
  return pages(contentFolder).flatMap((page) =>
    [...readFileSync(page, "utf8").matchAll(/^( *)```(\S*)([^\n]*)\n([\s\S]*?)^\1```$/gm)].map(
      (match) => {
        const meta = match[3]!.trim();
        const title = /(?:^|\s)title="([^"]*)"/.exec(meta)?.[1];
        return {
          page,
          lang: match[2]!,
          meta,
          title,
          body: match[4]!,
          kind: blockKind(match[2], title, meta),
        };
      },
    ),
  );
}

describe("the kind of a block", () => {
  it("comes from its fence language, its title and, for an Example, its path", () => {
    for (const lang of ["sh", "bash", "shell", "console", "powershell"])
      expect(blockKind(lang), lang).toBe("run");
    for (const lang of ["yaml", "yml", "json", "csv", "dotenv", "sql", "python"])
      expect(blockKind(lang), lang).toBe("write");
    expect(blockKind("text")).toBe("prints");
    expect(blockKind("text", ".gitignore")).toBe("write");
    expect(blockKind("plaintext")).toBe("prints");
    expect(exampleKind("flows/orders.yaml")).toBe("write");
    expect(exampleKind("transforms/store_sales.sql")).toBe("write");
    expect(exampleKind("build/dev/run.sql")).toBe("writes");
  });

  it("can be set with a kind mark on the fence, which wins", () => {
    expect(blockKind("json", undefined, 'kind="plain"')).toBe("plain");
    expect(blockKind("text", undefined, 'kind="write"')).toBe("write");
    expect(blockKind("yaml", "a.yaml", 'title="a.yaml" kind="writes"')).toBe("writes");
    expect(blockKind("sh", undefined, 'kind="other"')).toBe("run");
  });

  it("marks a Shiki block's kind, and the lines of a command that start one", () => {
    const pre = { properties: {} as Record<string, unknown> };
    const context = (lang: string, source: string, meta = {}) => ({
      source,
      options: { lang, meta },
    });
    transformerBlockKind.pre.call(context("sh", "a"), pre);
    expect(pre.properties.dataKind).toBe("run");
    const source = "# set up\nnpm install \\\n  -g ingestron\n\ncd shop";
    const lines = source
      .split("\n")
      .map(() => ({ properties: { class: "line" } as Record<string, unknown> }));
    lines.forEach((line, index) =>
      transformerBlockKind.line.call(context("sh", source), line, index + 1),
    );
    expect(lines.map((line) => line.properties.class)).toEqual([
      "line",
      "line cmd",
      "line",
      "line",
      "line cmd",
    ]);
    const output = { properties: { class: "line" } as Record<string, unknown> };
    transformerBlockKind.line.call(context("text", "dev → build/dev"), output, 1);
    expect(output.properties.class).toBe("line");
  });

  it("starts a command at each line but a comment, a blank or a continuation", () => {
    const lines = ["a \\", "  b", "", "# c", "d"];
    expect(lines.map((_, index) => startsCommand(lines, index))).toEqual([
      true,
      false,
      false,
      false,
      true,
    ]);
  });
});

describe("the kinds on the real pages", () => {
  const fences = pageFences();
  const byKind = (kind: BlockKind) => fences.filter((fence) => fence.kind === kind);

  it("make every sh fence a command, and no command writes the prompt itself", () => {
    const commands = fences.filter((fence) => fence.lang === "sh");
    expect(commands.length).toBeGreaterThan(50);
    expect(commands.every((fence) => fence.kind === "run")).toBe(true);
    for (const { page, body } of commands)
      for (const line of body.split("\n"))
        expect(line.trimStart().startsWith("$ "), `${page}: ${line}`).toBe(false);
  });

  it("make every unmarked YAML, CSV and dotenv fence a file the reader writes", () => {
    for (const fence of fences.filter(
      (found) =>
        ["yaml", "csv", "dotenv"].includes(found.lang) && !/(?:^|\s)kind=/.test(found.meta),
    ))
      expect(fence.kind, `${fence.page}: ${fence.lang}`).toBe("write");
  });

  it("treat an untitled text block as what a command prints, never as a file", () => {
    const printed = byKind("prints");
    expect(printed.length).toBeGreaterThan(40);
    for (const { page, lang, body } of printed) {
      expect(["text", "txt", "plaintext"], page).toContain(lang);
      // A dotenv file or a YAML file is a file, so it has its own language.
      expect(body, page).not.toMatch(/^[A-Z][A-Z0-9_]*=/m);
    }
  });

  it("carry a kind mark only where the rest cannot place the block", () => {
    const all = fences.filter((fence) => /(?:^|\s)kind=/.test(fence.meta));
    // The files the project guide for coding assistants writes, outside build/: the guide,
    // whose section Ingestron keeps, and two small files that are the reader's from then on.
    const guide = all.filter((fence) => fence.page.endsWith("/assistants.mdx"));
    expect(
      guide.map((fence) => /^kind="([a-z]+)" title="[^"]+\.md"$/.exec(fence.meta)?.[1]),
    ).toEqual(["plain", "plain", "writes"]);
    const marked = all.filter((fence) => !guide.includes(fence));
    // A payload a server returns; the source metadata an import writes outside build/; and a
    // contract Ingestron drafts that is the reader's to edit from then on, so neither a file
    // the reader writes nor a generated one.
    expect(marked.map((fence) => [fence.page.split("/").pop(), fence.meta])).toEqual([
      ["rest.mdx", 'kind="plain"'],
      ["describe-a-source.mdx", 'kind="writes" title="sources/erp.yaml"'],
      ["describe-a-source.mdx", 'kind="writes" title="sources/erp.yaml"'],
      ["describe-a-source.mdx", 'kind="plain" title="contracts/erp.payments.yaml"'],
    ]);
  });
});

describe("a block of each kind", () => {
  const show = (kind: BlockKind, title?: string) =>
    renderToStaticMarkup(
      createElement(KindBlock, { kind, title }, createElement("code", null, "x")),
    );

  it("names itself, and has a copy button only where copying helps", () => {
    const run = show("run");
    expect(run).toContain('data-kind="run"');
    expect(run).toContain("You run");
    expect(run).toMatch(/<button[^>]*aria-label="Copy commands"[^>]*>Copy<\/button>/);

    const write = show("write", "flows/orders.yaml");
    expect(write).toContain("You write");
    expect(write).toContain("flows/orders.yaml");
    expect(write).toContain('aria-label="Copy flows/orders.yaml"');

    const prints = show("prints");
    expect(prints).toContain("Ingestron prints");
    expect(prints).not.toContain("<button");

    const writes = show("writes", "build/dev/run.sql");
    expect(writes).toContain("Ingestron writes");
    expect(writes).toContain("build/dev/run.sql");
    expect(writes).toContain("Generated · don’t edit");
    expect(writes).not.toContain("<button");
  });

  it("is Fumadocs' own block when it has no kind", () => {
    const plain = show("plain");
    expect(plain).not.toContain("data-kind");
    expect(plain).not.toContain("You ");
  });

  it("draws the prompt in the stylesheet, so it is never in the text", () => {
    const css = file("app/blocks.css");
    expect(css).toMatch(
      /\.line\.cmd::before \{\s*content: "\$ ";\s*color: var\(--brand-signal\);\s*user-select: none;/,
    );
    expect(show("run")).not.toContain("$");
    // A copy button shows its focus, in a ring that is visible on ink too.
    expect(css).toContain(
      ".block-copy:focus-visible {\n  outline: 2px solid var(--color-fd-ring);",
    );
    expect(css).toMatch(
      /figure\[data-kind="run"\] \{[^}]*--color-fd-ring: var\(--brand-lavender\)/,
    );
  });
});

describe("the blocks' contrast", () => {
  const brand = Object.fromEntries(
    [...file("app/brand.css").matchAll(/--brand-([a-z-]+): (#[0-9a-f]{6});/g)].map((match) => [
      match[1]!,
      match[2]!,
    ]),
  );
  const rgb = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  /** CSS `color-mix(in srgb, a share%, b)`. */
  const mix = (a: string, share: number, b: string) =>
    "#" +
    rgb(a)
      .map((value, index) =>
        Math.round((value * share + rgb(b)[index]! * (100 - share)) / 100)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  const luminance = (hex: string) => {
    const [r, g, b] = rgb(hex).map((value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const ratio = (a: string, b: string) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high! + 0.05) / (low! + 0.05);
  };

  it("keeps every label, file name, note and button at 4.5:1 or better, in both themes", () => {
    const { ink, aubergine, plum, sand, lavender, muted } = brand;
    const onDark = brand["on-dark"]!;
    const onDarkMuted = brand["on-dark-muted"]!;
    const signalOnDark = brand["signal-on-dark"]!;
    const card = mix(ink!, 88, plum!);
    const raised = mix(ink!, 78, plum!);
    const pairs: [string, string, string][] = [
      ["run label", signalOnDark!, ink!],
      ["run prompt", brand.signal!, ink!],
      ["run file", onDarkMuted, ink!],
      ["run copy", onDark, aubergine!],
      ["write label", aubergine!, sand!],
      ["write copy", aubergine!, "#ffffff"],
      ["prints label", muted!, sand!],
      ["prints text", aubergine!, sand!],
      ["writes label", aubergine!, lavender!],
      ["writes note", muted!, lavender!],
      ["dark run label", signalOnDark!, mix(ink!, 70, aubergine!)],
      ["dark run file", onDarkMuted, mix(ink!, 70, aubergine!)],
      ["dark run copy", onDark, mix(aubergine!, 60, plum!)],
      ["dark write label", onDark, raised],
      ["dark write file", onDark, ink!],
      ["dark prints label", onDarkMuted, raised],
      ["dark prints text", onDark, raised],
      ["dark writes label", onDark, mix(ink!, 65, plum!)],
      ["dark writes note", onDarkMuted, mix(ink!, 65, plum!)],
      ["dark write code", "#8b949e", card],
    ];
    for (const [name, text, background] of pairs)
      expect(ratio(text, background), name).toBeGreaterThanOrEqual(4.5);
  });
});
