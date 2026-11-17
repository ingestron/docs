// The page at a shared page's old URL: the page is now one per platform.
import { pageName, sharedPages } from "@/lib/platforms";
import { PlatformChooserLinks } from "@/components/platform-choice";

/**
 * Links to each platform's version of a shared page.
 * @example <PlatformChooser page="guides/write-a-contract" />
 */
export function PlatformChooser({ page }: { page: string }) {
  const shared = sharedPages[page];
  if (!shared)
    throw new Error(`PlatformChooser: "${page}" is not a shared page in lib/platforms.ts.`);
  return (
    <>
      <p>This page has a version for each platform. Choose yours:</p>
      <PlatformChooserLinks page={pageName(page)} versions={shared.platforms} />
    </>
  );
}
