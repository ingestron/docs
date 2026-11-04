import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { syncVscodeCommands } from "./sync-vscode-commands.mjs";

test("copies the extension's Command Palette entries and version from its package.json", () => {
  const folder = mkdtempSync(join(tmpdir(), "vscode-"));
  const manifest = {
    version: "1.8.0",
    contributes: {
      commands: [
        { command: "ingestron.plan", title: "Plan", category: "Ingestron", icon: "$(eye)" },
      ],
    },
  };
  writeFileSync(join(folder, "package.json"), JSON.stringify(manifest));
  const out = join(folder, "commands.json");
  const version = join(folder, "extension.json");
  syncVscodeCommands(folder, out, version);
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), [
    { command: "ingestron.plan", title: "Plan", category: "Ingestron" },
  ]);
  assert.deepEqual(JSON.parse(readFileSync(version, "utf8")), { version: "1.8.0" });
});
