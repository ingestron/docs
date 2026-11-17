// "Accept a warning", run as each platform's page shows it: the project the
// page names, the warning it quotes, the list it adds, and the list one
// environment gives, each planned and compared with the page.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentFolder } from "../lib/content-files.js";
import { exampleFolder } from "../lib/examples.js";
import { pageText } from "../lib/platform-text.js";
import { cli, fences, section } from "./pages.js";

type On = "synapse" | "databricks" | "adf" | "duckdb";
const page = (on: On) => pageText(join(contentFolder, on, "(standards)/accept-a-warning.mdx"));

const write = (cwd: string, file: string, text: string) => writeFileSync(join(cwd, file), text);
const read = (cwd: string, file: string) => readFileSync(join(cwd, file), "utf8");
const ok = (cwd: string, args: string[]) => {
  const result = cli(cwd, args);
  expect(result.code, `${args.join(" ")}\n${result.output}`).toBe(0);
  return result.output;
};

/** The project each page uses, with the change the page makes before the warning. */
function project(on: On): string {
  const parent = mkdtempSync(join(tmpdir(), `docs-accept-${on}-`));
  const cwd = join(parent, "shop");
  if (on === "databricks") {
    cpSync(exampleFolder("retail-filled"), cwd, { recursive: true });
    const contract = read(cwd, "contracts/customers.yaml");
    write(
      cwd,
      "contracts/customers.yaml",
      contract.replace(
        "{ name: email, logicalType: string,",
        "{ name: email, logicalType: string, classification: confidential,",
      ),
    );
    return cwd;
  }
  if (on === "duckdb") {
    ok(parent, ["init", "shop", "--template", "duckdb", "--yes"]);
    return cwd;
  }
  const source = on === "synapse" ? "azure-sql-database" : "sqlserver";
  const connectivity = on === "synapse" ? "public" : "private";
  ok(
    parent,
    on === "synapse"
      ? [
          "init",
          "shop",
          "--platform",
          "synapse",
          "--set",
          "storage_account=stshoplanding",
          "--set",
          "key_vault=kv-shop",
          "--yes",
        ]
      : [
          "init",
          "shop",
          "--platform",
          "adf-landing",
          "--set",
          "storage_account=stshoplanding",
          "--set",
          "key_vault=kv-shop",
          "--set",
          "integration_runtime=ir-shop",
          "--yes",
        ],
  );
  ok(cwd, ["connection", "add", "sales", "--connector", source, "--connectivity", connectivity]);
  write(
    cwd,
    "connections/sales.yaml",
    `apiVersion: ingestron.io/v1\nkind: Connection\nid: sales\nconnector: ${source}\nconnectivity: ${connectivity}\nsettings:\n  server: sql-shop.example\n  user: reader\n  password: \${secret:sales-password}\n`,
  );
  ok(cwd, ["flow", "add", "orders", "--connection", "sales", "--object", "sales.dbo.orders"]);
  mkdirSync(join(cwd, "samples"), { recursive: true });
  write(
    cwd,
    "samples/orders.csv",
    "order_id,customer,amount,ordered_at\n1,acme,120.50,2026-11-02\n",
  );
  ok(cwd, ["contract", "samples/orders.csv", "--name", "orders"]);
  const uses = on === "synapse" ? "synapse-copy" : "adf-copy";
  const check =
    on === "synapse"
      ? "    expectations:\n      - { name: positive_amount, check: amount > 0, action: fail }\n"
      : "";
  write(
    cwd,
    "flows/orders.yaml",
    `apiVersion: ingestron.io/v1\nkind: Flow\nid: orders\nsource: sales\ningest:\n  uses: ${uses}\ntables:\n  orders:\n    object: sales.dbo.orders\n    contract: orders\n${check}`,
  );
  return cwd;
}

describe.each(["synapse", "databricks", "adf", "duckdb"] as const)(
  "accept a warning on %s",
  (on) => {
    it("quotes the warning its project gives, and accepts it with the page's list", () => {
      const text = page(on);
      const cwd = project(on);
      const warning = fences(text.split("\n## ")[0]!, "text")[0]!.trim().split("\n")[0]!;
      expect(ok(cwd, ["plan", "--no-diff"])).toContain(warning);
      const steps = section(text, "## Accept one warning [#accept]");
      write(
        cwd,
        "platform.yaml",
        `${read(cwd, "platform.yaml").trimEnd()}\n${fences(steps, "yaml")[0]!}`,
      );
      const output = ok(cwd, ["plan", "--no-diff"]);
      expect(output).toContain("1 accepted warning (platform.yaml)");
      expect(output).not.toContain(warning);
    }, 120_000);
  },
);

describe.each(["synapse", "databricks", "duckdb"] as const)(
  "accept a warning in prod only on %s",
  (on) => {
    it("shows it in dev and counts it accepted in prod, as the page prints", () => {
      const text = page(on);
      const cwd = project(on);
      const steps = section(text, "## Accept it in some environments only [#per-environment]");
      const entry = fences(section(text, "## Accept one warning [#accept]"), "yaml")[0]!
        .replace(/^accept:\n/, "")
        .replace(/^/gm, "    ")
        .trimEnd();
      write(
        cwd,
        "platform.yaml",
        `${read(cwd, "platform.yaml").trimEnd()}\naccept: \${values.accept}\n`,
      );
      let manifest = read(cwd, "project.yaml");
      manifest = /^ {2}prod:\n {4}values:\n/m.test(manifest)
        ? manifest.replace(
            /^ {2}prod:\n {4}values:\n/m,
            `  prod:\n    values:\n      accept:\n${entry}\n`,
          )
        : manifest.replace(
            /^ {2}dev: \{\}\n/m,
            `  dev: {}\n  prod:\n    values:\n      accept:\n${entry}\n`,
          );
      manifest = /^values:\n/m.test(manifest)
        ? manifest.replace(/^values:\n/m, "values:\n  accept: []\n")
        : manifest.replace(/^imports:/m, "values:\n  accept: []\nimports:");
      write(cwd, "project.yaml", manifest);
      const output = ok(cwd, ["plan", "--no-diff"]);
      const shown = fences(steps, "text").at(-1)!.trim().split("\n");
      let at = 0;
      for (const line of shown) {
        const found = output.indexOf(line, at);
        expect(found, `${on}: ${line}\n${output}`).toBeGreaterThanOrEqual(0);
        at = found + line.length;
      }
    }, 120_000);
  },
);
