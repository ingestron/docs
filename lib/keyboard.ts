// The DOM rules behind the site's keyboard fixes, kept apart from React so the
// tests can run them on plain objects.

/** The part of a DOM element these rules read. */
export interface ElementLike {
  parentElement: ElementLike | null;
  children: ArrayLike<ElementLike>;
}

/**
 * Everything on the page outside `element` that a modal must make inert: the
 * siblings of the element and of each of its ancestors, up to `root`. `keep`
 * stays usable, such as the drawer's overlay, which closes it when clicked.
 */
export function outside(element: ElementLike, root: ElementLike, keep: ElementLike[] = []) {
  const found: ElementLike[] = [];
  for (let node = element; node !== root && node.parentElement; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children))
      if (sibling !== node && !keep.includes(sibling)) found.push(sibling);
  }
  return found;
}

/** A tab, by the URL it opens and the URLs of the pages it holds. */
export interface AreaTab {
  url: string;
  urls: string[];
}

/**
 * What the tab's link says to assistive technology on `pathname`: `page` on
 * the page the tab opens, `true` on another page in its area, else nothing.
 * The last tab whose area holds the page wins, as Fumadocs shows it.
 */
export function tabCurrent(tabs: AreaTab[], pathname: string): (string | undefined)[] {
  const path = pathname.replace(/\/$/, "") || "/";
  const active = tabs.findLastIndex((tab) => tab.url === path || tab.urls.includes(path));
  return tabs.map((tab, index) =>
    index !== active ? undefined : tab.url === path ? "page" : "true",
  );
}

/**
 * Whether a frame holds more than it shows across, so it needs a tab stop for
 * the keyboard to scroll it. A pixel of rounding is not overflow.
 */
export function overflows(frame: { scrollWidth: number; clientWidth: number }): boolean {
  return frame.scrollWidth > frame.clientWidth + 1;
}
