"use client";
// A value still REPLACE_ME in a kit's file (components/reference/kits.tsx):
// marked by a dashed underline, a light tint and its note's number, not by
// colour alone, and focusable. On hover or focus it shows the field, where to find the value and
// a suggestion, in a tooltip drawn above the page, so the code block's
// scrolling frame does not clip it and Copy does not copy it. Escape closes
// it, and the pointer can move onto it. The same text is the note the mark's
// aria-describedby names, which touch screens show below the block.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Inline } from "./reference/inline";

/** The help one mark gives, as the editor's hover gives it. */
export interface ReplaceMeTip {
  field: string;
  description?: string;
  find?: string;
  suggest?: string;
}

/** One REPLACE_ME, with the id of its note and the note's number. */
export function ReplaceMe({
  note,
  number,
  tip,
  children,
}: {
  note: string;
  number: number;
  tip?: ReplaceMeTip;
  children: ReactNode;
}) {
  const mark = useRef<HTMLSpanElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const closing = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number } | undefined>();

  const show = () => {
    window.clearTimeout(closing.current);
    setOpen(true);
  };
  // A moment's grace, so the pointer can move from the mark onto the tooltip.
  const hide = () => {
    window.clearTimeout(closing.current);
    closing.current = window.setTimeout(() => setOpen(false), 150);
  };

  // Below the mark, or above it when there is no room, and inside the window.
  useLayoutEffect(() => {
    if (!open || !mark.current || !box.current) return;
    const at = mark.current.getBoundingClientRect();
    const size = box.current.getBoundingClientRect();
    const below = at.bottom + 6;
    const top = below + size.height > window.innerHeight ? at.top - 6 - size.height : below;
    const left = Math.max(8, Math.min(at.left, window.innerWidth - size.width - 8));
    setPlace({ top: Math.max(8, top), left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(closing.current), []);

  return (
    <span
      ref={mark}
      className="replace-me"
      data-note={number}
      tabIndex={0}
      aria-describedby={note}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open &&
        tip &&
        createPortal(
          <div
            ref={box}
            className="replace-me-tip"
            aria-hidden="true"
            style={place ? { top: place.top, left: place.left } : { visibility: "hidden" }}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <TipText tip={tip} />
          </div>,
          document.body,
        )}
    </span>
  );
}

/** The help as text: the field, then what it is, where to find it and a suggestion. */
export function TipText({ tip }: { tip: ReplaceMeTip }) {
  return (
    <>
      <strong>
        <code>{tip.field}</code>
      </strong>{" "}
      still needs a value.
      {tip.description && (
        <span className="replace-me-line">
          <Inline text={tip.description} />
        </span>
      )}
      {tip.find && (
        <span className="replace-me-line">
          Where to find it: <Inline text={tip.find} />
        </span>
      )}
      {tip.suggest && (
        <span className="replace-me-line">
          Suggested: <code>{tip.suggest}</code>
        </span>
      )}
    </>
  );
}
