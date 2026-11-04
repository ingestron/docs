// The frame every table scrolls in when it is wider than the page: one tab
// stop, named, which scrolls with the arrow keys when it has focus. It is the
// frame that scrolls, not the table, so focusing it is enough.
import type { ComponentProps, ReactNode } from "react";

/** A named, focusable frame around one table.
 * @example <TableFrame label="Commands"><table>…</table></TableFrame>
 */
export function TableFrame({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative overflow-auto prose-no-margin my-6 table-frame${className ? ` ${className}` : ""}`}
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      {children}
    </div>
  );
}

/** A Markdown table, named by `lib/rehype-frame-names.ts` after the heading it is under. */
export function MarkdownTable({
  "data-frame-label": label,
  ...props
}: ComponentProps<"table"> & { "data-frame-label"?: string }) {
  return (
    <TableFrame label={label ?? "Table"}>
      <table {...props} />
    </TableFrame>
  );
}
