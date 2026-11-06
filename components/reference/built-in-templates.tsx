// The templates `ingestron init` offers, from the CLI itself.
import { builtInTemplates } from "@ingestron/cli";
import { TableFrame } from "@/components/table-frame";

/** One row per built-in template: its name and what it sets up. `init` asks none of them anything. */
export function BuiltInTemplates() {
  return (
    <TableFrame label="Built-in starters">
      <table>
        <thead>
          <tr>
            <th>Template</th>
            <th>Sets up</th>
          </tr>
        </thead>
        <tbody>
          {builtInTemplates().map((template) => (
            <tr key={template.name}>
              <td>
                <code>{template.name}</code>
              </td>
              <td>
                <strong>{template.title}.</strong> {template.summary}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}
