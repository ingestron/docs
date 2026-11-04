import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/** The lockup's size: 128 px wide, above the brand's 96 px minimum. */
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
            src="/brand/lockup-horizontal-primary.svg"
            alt="Ingestron"
            {...lockup}
          />
          <img
            className="docs-brand-dark"
            src="/brand/lockup-horizontal-reverse.svg"
            alt="Ingestron"
            {...lockup}
          />
          <span className="docs-brand-label">docs</span>
        </span>
      ),
      url: "/docs",
    },
  };
}
