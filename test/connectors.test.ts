// Every connector a pack reads has a page and at least one example, and each
// pack that reads it has a sample whose connection and flow the page shows.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { connectorExample } from "../lib/connector-page.js";
import { exampleFiles, listExamples } from "../lib/examples.js";
import { connectorEntries, connectorIds } from "../lib/reference.js";

const catalogueExamples = listExamples();
const pages = join(process.cwd(), "content/docs/connectors");

describe("connector coverage", () => {
  for (const id of connectorIds()) {
    it(`${id} has a page and an example for each pack that reads it`, () => {
      expect(existsSync(join(pages, `${id}.mdx`)), `content/docs/connectors/${id}.mdx`).toBe(true);
      const examples = catalogueExamples.filter((example) => example.facts.connectors.includes(id));
      expect(examples.length, `a sample that reads ${id}`).toBeGreaterThan(0);
      for (const { pack } of connectorEntries(id)) {
        const { connection, flow } = connectorExample(id, pack);
        const sample = catalogueExamples.find((example) => example.name === connection.name);
        expect(sample?.facts.packs, `${id}: ${connection.name} uses ${pack}`).toContain(pack);
        expect(sample?.facts.connectors, `${id}: ${connection.name} reads it`).toContain(id);
        expect(exampleFiles(connection.name)).toContain(connection.file);
        expect(exampleFiles(flow.name)).toContain(flow.file);
      }
    });
  }
});
