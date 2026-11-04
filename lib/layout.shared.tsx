import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/** The Ingestron logo's size: 128 px wide (its file is 640 × 144), above the 96 px minimum. */
const lockup = { width: 128, height: 29 };

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        // The primary lockup on paper and the reverse lockup on ink; the
        // stylesheet shows the one that matches the theme.
        <span className="docs-brand">
          <img
            className="docs-brand-light"
            src="/brand/ingestron-lockup-primary.svg"
            alt="Ingestron"
            {...lockup}
          />
          <img
            className="docs-brand-dark"
            src="/brand/ingestron-lockup-reverse.svg"
            alt="Ingestron"
            {...lockup}
          />
          <span className="docs-brand-label">docs</span>
        </span>
      ),
      url: "/docs",
    },
    // In the header on wide screens and at the top of the menu on narrow ones.
    links: [{ text: "YAML syntax", url: "/docs/concepts/yaml-references" }],
    githubUrl: "https://github.com/ingestron",
  };
}
