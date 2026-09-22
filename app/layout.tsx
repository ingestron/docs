import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";

import "./global.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.ingestron.io"),
  title: {
    default: "Ingestron documentation",
    template: "%s — Ingestron docs",
  },
  description:
    "Learn to describe data, review contracts and run local pipelines with Ingestron.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-NZ" suppressHydrationWarning>
      <body>
        <RootProvider theme={{ enabled: false }}>{children}</RootProvider>
      </body>
    </html>
  );
}
