// The VS Code extension's commands, copied from its package.json by
// `pnpm sync:vscode`.
import commands from "./vscode-commands.json";

/** One row per command in the Command Palette. */
export function ExtensionCommands() {
  return (
    <ul>
      {commands.map((command) => (
        <li key={command.command}>
          <strong>
            {command.category}: {command.title}
          </strong>
        </li>
      ))}
    </ul>
  );
}
