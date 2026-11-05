// Shows one real file of a tested example, or part of it, and what Ingestron
// prints for it; the build fails if the file, part or section is missing.
import { KindBlock } from "@/components/code-block";
import { exampleKind, type BlockKind } from "@/lib/block-kind";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { codeThemes } from "@/lib/code-themes";
import {
  exampleRequest,
  exampleTree,
  readExampleExtract,
  readExampleFile,
  readTemplateExtract,
  requestSections,
  type ExtractPart,
} from "@/lib/examples";

/** A highlighted block of one kind, with its title and the name its scrolling frame reads out. */
function Block({
  code,
  lang,
  kind,
  title,
  label,
}: {
  code: string;
  lang: string;
  kind: BlockKind;
  title?: string;
  label: string;
}) {
  return (
    <ServerCodeBlock
      code={code}
      lang={lang}
      themes={codeThemes}
      components={{
        pre: ({ children, ...props }) => (
          <KindBlock
            {...props}
            kind={kind}
            title={title}
            className="my-4"
            viewportProps={{ "aria-label": label }}
          >
            {children}
          </KindBlock>
        ),
      }}
    />
  );
}

/** Which part of the file to show, if not all of it; the props as a page writes them. */
function extractPart({
  pick,
  from,
  to,
}: {
  pick?: string;
  from?: string;
  to?: string;
}): ExtractPart | undefined {
  if (pick !== undefined && (from !== undefined || to !== undefined)) {
    throw new Error("Example: give pick, or from and to, not both");
  }
  if ((from === undefined) !== (to === undefined)) {
    throw new Error("Example: give from and to together");
  }
  if (pick !== undefined) return { pick };
  if (from !== undefined && to !== undefined) return { from, to };
  return undefined;
}

/**
 * One file of an example, as it is in the repository; a `build/` file is what
 * Ingestron generates for it. With `pick` (a YAML or JSON path), or `from`
 * and `to` (text on the first and last lines), only that part, as it is in
 * the file.
 * @example <Example name="retail" file="build/databricks/databricks.yml" pick="targets" />
 * @example <Example name="synapse-views" file="build/synapse/views.sql" from="CREATE OR ALTER VIEW [bronze].[customers]" to="GO" />
 */
export function Example({
  name,
  file,
  ...parts
}: {
  name: string;
  file: string;
  pick?: string;
  from?: string;
  to?: string;
}) {
  const extension = file.split(".").pop() ?? "text";
  const part = extractPart(parts);
  const shown = part === undefined ? file : `${file} › ${"pick" in part ? part.pick : part.from}`;
  return (
    <Block
      code={(part ? readExampleExtract(name, file, part) : readExampleFile(name, file)).trimEnd()}
      lang={extension === "yml" ? "yaml" : extension}
      kind={exampleKind(file)}
      title={shown}
      label={`${name}/${shown}`}
    />
  );
}

/**
 * The listing of a folder Ingestron generates for an example, such as
 * `build/adf`: folders first, then files.
 * @example <BuildTree name="northwind" folder="build/adf" />
 */
export function BuildTree({ name, folder }: { name: string; folder: string }) {
  return (
    <Block
      code={exampleTree(name, folder)}
      lang="text"
      kind="prints"
      label={`The files under ${folder} in ${name}`}
    />
  );
}

/**
 * What `ingestron request --env <env>` prints for an example: all of it, or
 * the named `## ` sections, each with its heading.
 * @example <Request name="landing-only" />
 * @example <Request name="duckdb-local" sections={["DuckDB job"]} />
 */
export function Request({
  name,
  env = "dev",
  sections,
}: {
  name: string;
  env?: string;
  sections?: string[];
}) {
  if (sections?.length === 0) throw new Error(`Request: name a section of ${name}'s request`);
  return (
    <Block
      code={sections ? requestSections(name, env, sections) : exampleRequest(name, env)}
      lang="text"
      kind="prints"
      label={`The platform request for ${name} (${env})`}
    />
  );
}

/**
 * Part of a template in `ci-templates/`, a file you deploy or add to a
 * pipeline: the first line containing `from` through the next containing `to`.
 * @example <Template file="azure/duckdb-job.bicep" from="param name" to="param memory" />
 */
export function Template({ file, from, to }: { file: string; from: string; to: string }) {
  const shown = `ci-templates/${file} › ${from}`;
  return (
    <Block
      code={readTemplateExtract(file, from, to).trimEnd()}
      lang={file.split(".").pop() ?? "text"}
      kind="write"
      title={shown}
      label={shown}
    />
  );
}

/** A link to the whole example as a zip file. */
export function ExampleDownload({ name }: { name: string }) {
  return (
    <a className="download-button" download href={`/downloads/${name}.zip`}>
      ↓ Download {name}.zip
    </a>
  );
}
