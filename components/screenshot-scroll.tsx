"use client";
// The frame a screenshot scrolls in on a narrow screen. It is a region named
// after the shot, and a tab stop only while the image is wider than the
// frame, so the arrow keys can scroll it; at desktop width nothing scrolls
// and the keyboard passes it by. The server renders it focusable, so it
// works before the script runs; the check runs once mounted, when each image
// loads and whenever the frame changes size.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { overflows } from "@/lib/keyboard";

/** A named frame that is a tab stop only while its content overflows.
 * @example <ScreenshotScroll label="The editor with a hover">…</ScreenshotScroll>
 */
export function ScreenshotScroll({ label, children }: { label: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(true);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const check = () => setScrolls(overflows(element));
    check();
    const images = [...element.querySelectorAll("img")];
    for (const image of images) image.addEventListener("load", check);
    const resized = new ResizeObserver(check);
    resized.observe(element);
    return () => {
      resized.disconnect();
      for (const image of images) image.removeEventListener("load", check);
    };
  }, []);
  return (
    <div
      ref={frame}
      className="screenshot-scroll"
      role="region"
      aria-label={label}
      tabIndex={scrolls ? 0 : undefined}
    >
      {children}
    </div>
  );
}
