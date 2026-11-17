import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { preload } from "react-dom";
import { RootProvider } from "fumadocs-ui/provider/next";
import { SearchFocusReturn } from "@/components/keyboard";
import { PlatformSearchDialog } from "@/components/platform-search";
import { siteScript } from "@/lib/site-script";

import "./global.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.ingestron.io"),
  title: {
    default: "Ingestron documentation",
    template: "%s — Ingestron docs",
  },
  description:
    "Generate data platform assets from reviewed definitions and your organisation's standards.",
  // The Ingestron logo's mark: aubergine on a light browser, paper on a dark one.
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#160b1a" },
  ],
};

export default function Layout({ children }: { children: ReactNode }) {
  // The text font, fetched with the page rather than once the stylesheet asks.
  preload("/fonts/manrope-variable.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        {/* Before the header paints: which platform's tabs to show
            (lib/site-script.ts). Here, in the root layout, the server
            renders it once; a page change does not render it again, and
            PlatformMemory marks each page the reader moves to. */}
        <script dangerouslySetInnerHTML={{ __html: siteScript() }} />
      </head>
      <body>
        <RootProvider theme={{ enabled: true }} search={{ SearchDialog: PlatformSearchDialog }}>
          <SearchFocusReturn />
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
