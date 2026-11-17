// Counts each site page's mentions of platforms it may not name, for
// test/platform-leak.test.ts: a platform's pages name only it, and a
// combination's only its two (lib/platforms.ts's allowedOn). A connector's
// page may name its own source, such as Azure Synapse read as a source.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { contentFolder } from "../lib/content-files";
import { pageText } from "../lib/platform-text";
import { allowedOn, leakWords, platformOfPath } from "../lib/platforms";

/** A connector page's own source, by its title and id, which it may name. */
function ownSource(file: string, text: string): string {
  if (!file.includes("/connectors/")) return text;
  const id = file
    .split("/")
    .at(-1)!
    .replace(/\.mdx$/, "");
  const title = /^title: "?(.+?)"?$/m.exec(readFileSync(join(contentFolder, file), "utf8"))?.[1];
  let rest = text.replaceAll(id, "");
  if (title) rest = rest.replaceAll(title, "");
  return rest;
}

/** Every site page, and its mentions of the platforms it may not name. */
export function mentions(): Record<string, Record<string, number>> {
  const found: Record<string, Record<string, number>> = {};
  const files = readdirSync(contentFolder, { recursive: true, encoding: "utf8" })
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => file.endsWith(".mdx") && platformOfPath(file))
    .sort();
  for (const file of files) {
    const id = platformOfPath(file)!;
    const text = ownSource(file, pageText(join(contentFolder, file)));
    for (const [other, words] of Object.entries(leakWords)) {
      if (allowedOn(id).includes(other)) continue;
      const count = text.match(words)?.length ?? 0;
      if (count > 0) (found[file] ??= {})[other] = count;
    }
  }
  return found;
}

/** Each leaking line of a page, for fixing it: `pnpm tsx test/leaks.ts <page>`. */
export function leakingLines(file: string): string[] {
  const id = platformOfPath(file)!;
  const words = Object.entries(leakWords)
    .filter(([other]) => !allowedOn(id).includes(other))
    .map(([, re]) => new RegExp(re.source, "i"));
  return ownSource(file, pageText(join(contentFolder, file)))
    .split("\n")
    .map((line, at) => `${at + 1}: ${line}`)
    .filter((line) => words.some((re) => re.test(line.replace(/^\d+: /, ""))));
}

if (process.argv[1]?.endsWith("leaks.ts"))
  for (const file of process.argv.slice(2))
    console.log(`== ${file}\n${leakingLines(file).join("\n")}`);
