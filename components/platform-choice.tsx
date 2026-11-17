"use client";
// The reader's platform: remembered from the last platform page they opened,
// so an old guide link goes straight to their version, and shared pages can
// offer the way back. Browser storage only; everything works without it.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { platformIds, platformOfPath, platforms, siteMark } from "@/lib/platforms";

const key = "ingestron-platform";

/** The remembered platform id, or undefined when there is none or storage is blocked. */
export function rememberedPlatform(): string | undefined {
  try {
    const id = window.localStorage.getItem(key) ?? undefined;
    return id && (platformIds as string[]).includes(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Remembers a platform, and marks <html data-site> so the header shows its
 * tabs (app/navigation.css). With storage blocked, only the mark is set.
 */
export function rememberPlatform(id: string): void {
  document.documentElement.dataset.site = id;
  try {
    window.localStorage.setItem(key, id);
  } catch {
    // Storage blocked: nothing is remembered.
  }
}

/**
 * Remembers the platform of each platform page the reader opens, and on every
 * page change, not only a full load, marks <html data-site> with the platform
 * whose tabs to show. Renders nothing.
 */
export function PlatformMemory() {
  const path = usePathname();
  useEffect(() => {
    const id = platformOfPath(path);
    if (id) rememberPlatform(id);
    const mark = siteMark(path, rememberedPlatform());
    if (mark) document.documentElement.dataset.site = mark;
    else delete document.documentElement.dataset.site;
  }, [path]);
  return null;
}

/**
 * The versions of a page that moved into the platform sites, at its old URL.
 * With a remembered platform that has the page, it goes there at once,
 * keeping the link's #section.
 * @example <PlatformChooserLinks page="write-a-contract" versions={["synapse", "duckdb"]} />
 */
export function PlatformChooserLinks({ page, versions }: { page: string; versions: string[] }) {
  const [hash, setHash] = useState("");
  useEffect(() => {
    setHash(window.location.hash);
    const id = rememberedPlatform();
    if (id && versions.includes(id))
      window.location.replace(`/docs/${id}/${page}${window.location.hash}`);
  }, [page, versions]);
  return (
    <ul className="platform-chooser">
      {platforms
        .filter((platform) => versions.includes(platform.id))
        .map((platform) => (
          <li key={platform.id}>
            <Link href={`/docs/${platform.id}/${page}${hash}`}>{platform.title}</Link>
            <span> — {platform.summary}</span>
          </li>
        ))}
    </ul>
  );
}

/** "Continue with Azure Synapse" on the home page, when a platform is remembered. */
export function ContinueWithPlatform() {
  const [id, setId] = useState<string>();
  useEffect(() => setId(rememberedPlatform()), []);
  const platform = platforms.find((item) => item.id === id);
  if (!platform) return null;
  return (
    <p className="platform-continue">
      <Link href={`/docs/${platform.id}`}>Continue with {platform.title}</Link>
    </p>
  );
}
