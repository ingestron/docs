"use client";
// Small additions to Fumadocs' layouts for keyboard and screen-reader use,
// where Fumadocs 16.17.8 has no option for them. Each works on the markup
// Fumadocs renders, by its ids and data attributes; test/keyboard.test.ts and
// scripts/check-links.ts fail if those change.
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "fumadocs-ui/components/sidebar/base";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { outside, tabCurrent, type AreaTab } from "@/lib/keyboard";

/** The first stop on every page: straight past the header, tabs and menu to the content.
 * @example <SkipLink target="nd-page" />
 */
export function SkipLink({ target }: { target: string }) {
  return (
    <a className="skip-link" href={`#${target}`}>
      Skip to content
    </a>
  );
}

/**
 * The phone menu as a modal dialog: named, the page behind it inert while it
 * is open, Escape closing it, and focus back on the menu button when it closes
 * without leaving the page. Fumadocs' drawer is `#nd-sidebar-mobile`.
 */
export function MenuDialog() {
  const { open, setOpen, mode } = useSidebar();
  useEffect(() => {
    if (!open || mode !== "drawer") return;
    const drawer = document.getElementById("nd-sidebar-mobile");
    if (!drawer) return;
    const button = document.querySelector<HTMLElement>(
      '#nd-subnav button[aria-controls="nd-sidebar-mobile"]',
    );
    const page = window.location.pathname;
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-label", "Menu");
    // The overlay beside the drawer closes it when tapped, so it stays live:
    // Fumadocs gives it the drawer's data-state, no id, and a fixed position.
    const overlays = Array.from(drawer.parentElement?.children ?? []).filter(
      (element) =>
        element !== drawer &&
        element.hasAttribute("data-state") &&
        !element.id &&
        getComputedStyle(element).position === "fixed",
    );
    const behind = (outside(drawer, document.body, overlays) as HTMLElement[]).filter(
      (element) => !element.inert,
    );
    for (const element of behind) element.inert = true;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      for (const element of behind) element.inert = false;
      const lost = !document.activeElement || document.activeElement === document.body;
      const inMenu = drawer.contains(document.activeElement);
      if (window.location.pathname === page && (lost || inMenu)) button?.focus();
    };
  }, [open, mode, setOpen]);
  return null;
}

/**
 * `aria-current` on the area tab that holds the page: `page` when the tab
 * opens this page, `true` on the area's other pages. Fumadocs marks the tab
 * only by colour, and a tab's props are fixed for every page.
 */
export function AreaTabsCurrent({ tabs }: { tabs: AreaTab[] }) {
  const pathname = usePathname();
  useEffect(() => {
    const current = tabCurrent(tabs, pathname);
    const links = document.querySelectorAll<HTMLAnchorElement>("[data-header-tabs] a[href]");
    for (const link of links) {
      const index = tabs.findIndex((tab) => tab.url === link.getAttribute("href"));
      const value = index === -1 ? undefined : current[index];
      if (value) link.setAttribute("aria-current", value);
      else link.removeAttribute("aria-current");
    }
  }, [tabs, pathname]);
  return null;
}

/**
 * Focus back where it was when the search dialog closes. Fumadocs opens the
 * dialog from its own state, so the dialog has no trigger to return focus to,
 * and focus falls to the page's body.
 */
export function SearchFocusReturn() {
  const { open } = useSearchContext();
  const last = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest?.('[role="dialog"]')) last.current = target;
    };
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, []);
  const wasOpen = useRef(open);
  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    // The dialog plays its closing animation, then leaves, dropping focus on
    // the body; wait for that, for up to a second, then put focus back.
    let frames = 0;
    let frame = 0;
    const settle = () => {
      const active = document.activeElement;
      if (!active || active === document.body) {
        if (last.current?.isConnected) last.current.focus();
        return;
      }
      if (!active.closest('[role="dialog"]') || ++frames > 60) return;
      frame = window.requestAnimationFrame(settle);
    };
    frame = window.requestAnimationFrame(settle);
    return () => window.cancelAnimationFrame(frame);
  }, [open]);
  return null;
}
