// Zips each sample into public/downloads/<name>.zip before the build: a
// guide's committed files, and for a starter what `ingestron init` writes from
// it. The folder is emptied first, so no stale zip ships.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { zipSync } from "fflate";
import { downloadFolder, exampleFiles, listExamples } from "../lib/examples.js";

const out = join(process.cwd(), "public/downloads");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const examples = listExamples();
for (const { name } of examples) {
  const files: Record<string, Uint8Array> = {};
  for (const file of exampleFiles(name))
    files[`${name}/${file}`] = readFileSync(join(downloadFolder(name), file));
  writeFileSync(join(out, `${name}.zip`), zipSync(files));
}
console.log(`✓ ${examples.length} example downloads`);
