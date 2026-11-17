// A platform page's text as the site shows it, for tests and checks that read
// pages as text: its <include>s expanded, then lib/remark-only.ts's rules
// applied to the text. The build itself uses the remark plugin.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { here, hereOn, onlyPlatforms } from "./remark-only";
import { noteShownOn, platformOfPath, type Platform } from "./platforms";

/** A page's text with each `<include>path</include>` replaced by that file's body. */
export function expandIncludes(text: string, folder: string): string {
  return text.replace(/<include>([^<]+)<\/include>/g, (_, path: string) => {
    const file = resolve(folder, path.trim());
    const body = readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
    return expandIncludes(body, dirname(file));
  });
}

/** Text kept to one platform: its <Only> blocks kept, others removed, `/docs/~/` links resolved. */
export function onlyFor(text: string, platform: string, where = "text"): string {
  let out = text;
  // Innermost first, so nested blocks resolve.
  const block = /<Only on="([^"]*)">((?:(?!<Only on=)[\s\S])*?)<\/Only>/;
  for (let found = block.exec(out); found; found = block.exec(out)) {
    const keep = onlyPlatforms(found[1]!, where).includes(platform);
    out =
      out.slice(0, found.index) +
      (keep ? found[2]! : "") +
      out.slice(found.index + found[0].length);
  }
  out = out.replace(
    /<ConnectorNote at="([^"]+)">[\s\S]*?\n<\/ConnectorNote>\n?/g,
    (note, at: string) => (noteShownOn(at, platform as Platform["id"]) ? note : ""),
  );
  return out
    .replace(new RegExp(`${here}[a-z0-9/#-]*`, "g"), (url) => hereOn(url, platform))
    .replaceAll('platform="~"', `platform="${platform}"`)
    .replace(/ name="([a-z0-9-]+)-~"/g, ` name="$1-${platform}"`);
}

/** A page file's text as its platform shows it; a page outside a platform folder comes back expanded only. */
export function pageText(file: string): string {
  const expanded = expandIncludes(readFileSync(file, "utf8"), dirname(file));
  const platform = platformOfPath(file);
  return platform ? onlyFor(expanded, platform, file) : expanded;
}

/** Whether a page is only a stub: front matter and one `<include>` of a shared file. */
export function isStub(text: string): boolean {
  return /^---\n(?:(?!---\n)[^\n]*\n)+---\n\s*<include>[^<]+<\/include>\s*$/.test(text);
}
