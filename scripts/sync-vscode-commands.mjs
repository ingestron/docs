// Copies the VS Code extension's Command Palette entries into this site.
// The extension lives in its own repository, so the site keeps a copy:
//   pnpm sync:vscode <path to an ingestron/vscode checkout>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Where the site reads the commands from. */
export const commandsFile = join(
  import.meta.dirname,
  "../components/reference/vscode-commands.json",
);

/** Writes the extension's commands (command, title, category) to `out`. */
export function syncVscodeCommands(extensionFolder, out = commandsFile) {
  const manifest = JSON.parse(readFileSync(join(extensionFolder, "package.json"), "utf8"));
  const commands = manifest.contributes.commands.map(({ command, title, category }) => ({
    command,
    title,
    category,
  }));
  writeFileSync(out, `${JSON.stringify(commands, null, 2)}\n`);
  return commands.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const folder = process.argv[2];
  if (!folder) {
    console.error("Usage: pnpm sync:vscode <path to an ingestron/vscode checkout>");
    process.exit(1);
  }
  console.log(`Copied ${syncVscodeCommands(folder)} commands.`);
}
