import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { syncVscodeCommands } from "./sync-vscode-commands.mjs";

test("copies the extension's Command Palette entries from its package.json", () => {
  const folder = mkdtempSync(join(tmpdir(), "vscode-"));
  const manifest = {
    contributes: {
      commands: [
        { command: "ingestron.plan", title: "Plan", category: "Ingestron", icon: "$(eye)" },
      ],
    },
  };
  writeFileSync(join(folder, "package.json"), JSON.stringify(manifest));
  const out = join(folder, "commands.json");
  syncVscodeCommands(folder, out);
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), [
    { command: "ingestron.plan", title: "Plan", category: "Ingestron" },
  ]);
});
