"use client";
// A code block that says what it is before the reader reads it: Fumadocs'
// CodeBlock with a header naming the kind (lib/block-kind.ts), a copy button
// where copying helps, and for a generated file the note not to edit it. The
// `$` of a command is drawn by the stylesheet, so it is never copied.
import { useRef, type ComponentProps } from "react";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { useCopyButton } from "fumadocs-ui/utils/use-copy-button";
import type { BlockKind } from "@/lib/block-kind";

const labels = {
  run: "You run",
  write: "You write",
  prints: "Ingestron prints",
  writes: "Ingestron writes",
} as const;

type Props = Omit<ComponentProps<typeof CodeBlock>, "title" | "icon"> & {
  kind?: BlockKind;
  /** The file's name or path, shown beside the label. */
  title?: string;
};

/** Copies the block's code, without anything the stylesheet draws around it. */
function CopyButton({ name }: { name: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const [copied, copy] = useCopyButton(() => {
    const pre = button.current?.closest("figure")?.getElementsByTagName("pre").item(0);
    if (pre) return navigator.clipboard.writeText(pre.textContent ?? "");
  });
  return (
    <button
      ref={button}
      type="button"
      className="block-copy"
      aria-label={copied ? "Copied" : name}
      aria-live="polite"
      onClick={copy}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** A code block of one kind; a block of no kind is Fumadocs' own. */
export function KindBlock({ kind = "plain", title, children, ...props }: Props) {
  if (kind === "plain")
    return (
      <CodeBlock {...props} title={title}>
        <Pre>{children}</Pre>
      </CodeBlock>
    );
  const label = labels[kind];
  return (
    <CodeBlock
      {...props}
      data-kind={kind}
      allowCopy={false}
      title={
        <>
          {kind === "writes" && (
            <svg className="block-tile" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <rect x="1" y="1" width="10" height="10" rx="2" />
            </svg>
          )}
          <span className="block-label">{label}</span>
          {title && <span className="block-file">{title}</span>}
        </>
      }
      Actions={() =>
        kind === "writes" ? (
          <span className="block-note">Generated · don&rsquo;t edit</span>
        ) : kind === "prints" ? null : (
          <CopyButton
            name={title ? `Copy ${title}` : kind === "run" ? "Copy commands" : "Copy file"}
          />
        )
      }
    >
      <Pre>{children}</Pre>
    </CodeBlock>
  );
}
