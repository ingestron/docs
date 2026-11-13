// Source metadata recipes, from the installed @ingestron/standards package:
// the list, each recipe's section, and the short section a connector's page
// shows for the recipe its connections use.
import { Fragment } from "react";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { Heading } from "fumadocs-ui/components/heading";
import type { SourceRecipe } from "@ingestron/core";
import { KindBlock } from "@/components/code-block";
import { TableFrame } from "@/components/table-frame";
import { codeThemes } from "@/lib/code-themes";
import {
  connectorRecipes,
  howBlocks,
  kindWords,
  readerWords,
  recipePage,
  recipes,
  type ConnectorRecipe,
} from "@/lib/recipes";
import { connectorEntries, connectorIds } from "@/lib/reference";

/** A connector's name, as the packs title it. */
const connectorTitle = (id: string) => connectorEntries(id)[0]?.connector.title ?? id;

/** The connectors whose page shows a recipe, and how each uses it. */
function usedBy(recipe: SourceRecipe): { connector: string; how: ConnectorRecipe["how"] }[] {
  return connectorIds().flatMap((connector) =>
    connectorRecipes(connector)
      .filter((item) => item.recipe.id === recipe.id)
      .map((item) => ({ connector, how: item.how })),
  );
}

/** How a recipe names a table. */
function namesWords(recipe: SourceRecipe): string | undefined {
  if (!recipe.names) return undefined;
  const { parts, caseSensitive } = recipe.names;
  return `${parts} ${parts === 1 ? "part" : "parts"}, ${caseSensitive ? "case-sensitive" : "not case-sensitive"}`;
}

/**
 * Every recipe installed with Ingestron, linked to its section: what it reads, with which
 * reader, what it asks you to fill in, and the connectors that use it without being told to.
 * @example <RecipeList />
 */
export function RecipeList() {
  return (
    <TableFrame label="Source metadata recipes">
      <table>
        <thead>
          <tr>
            <th>Recipe</th>
            <th>Gets</th>
            <th>Inputs</th>
            <th>Used by default for</th>
          </tr>
        </thead>
        <tbody>
          {recipes().map((recipe) => (
            <tr key={recipe.id}>
              <td>
                <a href={recipePage(recipe.id)}>{recipe.title}</a> (<code>{recipe.id}</code>)
              </td>
              <td>{kindWords[recipe.kind]}</td>
              <td>
                {Object.keys(recipe.inputs).length === 0
                  ? "None"
                  : Object.keys(recipe.inputs).map((name, index) => (
                      <Fragment key={name}>
                        {index > 0 && ", "}
                        <code>{name}</code>
                      </Fragment>
                    ))}
              </td>
              <td>
                {usedBy(recipe)
                  .filter((item) => item.how === "default")
                  .map((item, index) => (
                    <Fragment key={item.connector}>
                      {index > 0 && ", "}
                      <a href={`/docs/connectors/${item.connector}`}>
                        {connectorTitle(item.connector)}
                      </a>
                    </Fragment>
                  ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

/** The recipe's query or call, in a block that says it is not a command for the shell. */
function Step({ recipe }: { recipe: SourceRecipe }) {
  const { run, call } = recipe.ask;
  const code = (run ?? call)!;
  return (
    <ServerCodeBlock
      code={code.trimEnd()}
      lang={run === undefined ? "text" : "sql"}
      themes={codeThemes}
      components={{
        pre: ({ children, ...props }) => (
          <KindBlock
            {...props}
            title={run === undefined ? "URL to call" : "Query to run"}
            className="my-4"
            viewportProps={{
              "aria-label": `${recipe.title}: ${run === undefined ? "URL" : "query"}`,
            }}
          >
            {children}
          </KindBlock>
        ),
      }}
    />
  );
}

/** A command a recipe's `how` shows, in a block of commands. */
function HowCommand({ recipe, text }: { recipe: SourceRecipe; text: string }) {
  return (
    <ServerCodeBlock
      code={text}
      lang="sh"
      themes={codeThemes}
      components={{
        pre: ({ children, ...props }) => (
          <KindBlock
            {...props}
            kind="run"
            className="my-4"
            viewportProps={{ "aria-label": `${recipe.title}: command` }}
          >
            {children}
          </KindBlock>
        ),
      }}
    />
  );
}

/** One recipe's section: the request's step, its inputs and where it comes from. */
function RecipeSection({ recipe }: { recipe: SourceRecipe }) {
  const inputs = Object.entries(recipe.inputs);
  const names = namesWords(recipe);
  const users = usedBy(recipe);
  return (
    <section>
      <Heading as="h3" id={recipe.id}>
        {recipe.title}
      </Heading>
      <dl className="connector-summary">
        <dt>Recipe</dt>
        <dd>
          <code>{recipe.id}</code>
        </dd>
        <dt>Gets</dt>
        <dd>{kindWords[recipe.kind]}</dd>
        <dt>Reads</dt>
        <dd>{readerWords[recipe.read]}</dd>
        {names && (
          <>
            <dt>Table names</dt>
            <dd>{names}</dd>
          </>
        )}
        <dt>Who</dt>
        <dd>{recipe.ask.who}</dd>
        <dt>Access</dt>
        <dd>{recipe.ask.access}</dd>
        <dt>Save as</dt>
        <dd>
          <code>{recipe.ask.save}</code>
        </dd>
        {users.length > 0 && (
          <>
            <dt>Connectors</dt>
            <dd>
              {users.map((item, index) => (
                <Fragment key={item.connector}>
                  {index > 0 && ", "}
                  <a href={`/docs/connectors/${item.connector}#source-metadata`}>
                    {connectorTitle(item.connector)}
                  </a>
                  {item.how === "default" && " (by default)"}
                </Fragment>
              ))}
            </dd>
          </>
        )}
      </dl>
      {(recipe.ask.run !== undefined || recipe.ask.call !== undefined) && <Step recipe={recipe} />}
      {recipe.ask.how &&
        howBlocks(recipe.ask.how).map((block) =>
          block.command ? (
            <HowCommand key={block.text} recipe={recipe} text={block.text} />
          ) : (
            <p key={block.text}>{block.text}</p>
          ),
        )}
      {inputs.length > 0 && (
        <TableFrame label={`Inputs of the ${recipe.title} recipe`}>
          <table>
            <thead>
              <tr>
                <th>Input</th>
                <th>What to write</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {inputs.map(([name, input]) => (
                <tr key={name}>
                  <td>
                    <code>{name}</code>
                  </td>
                  <td>{input.description}</td>
                  <td>{input.default === undefined ? "None" : <code>{input.default}</code>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      )}
      <p>
        <strong>Documentation:</strong>
      </p>
      <ul>
        {recipe.sources.map((source) => (
          <li key={source.url}>
            <a href={source.url}>{source.url}</a> (read {source.read})
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Each installed recipe's section, with an anchor of the recipe's id.
 * @example <RecipeCatalog />
 */
export function RecipeCatalog() {
  return (
    <>
      {recipes().map((recipe) => (
        <RecipeSection key={recipe.id} recipe={recipe} />
      ))}
    </>
  );
}

/**
 * The short section on a connector's page: the recipes its connections use, who to ask and
 * what the recipe needs.
 * @example <ConnectorRecipes id="sqlserver" />
 */
export function ConnectorRecipes({ id }: { id: string }) {
  const found = connectorRecipes(id);
  if (found.length === 0) throw new Error(`No recipe is shown for connector "${id}".`);
  return (
    <>
      {found.map(({ recipe, how }) => (
        <Fragment key={recipe.id}>
          <p>
            {how === "default" ? (
              <>
                A connection with no <code>metadata</code> uses the{" "}
                <a href={recipePage(recipe.id)}>{recipe.title}</a> recipe.
              </>
            ) : (
              <>
                Name the <a href={recipePage(recipe.id)}>{recipe.title}</a> recipe in the
                connection&rsquo;s <code>metadata.from</code>: <code>{recipe.id}</code>.
              </>
            )}{" "}
            It asks someone to save <code>{recipe.ask.save}</code>.
          </p>
          <dl className="connector-summary">
            <dt>Who</dt>
            <dd>{recipe.ask.who}</dd>
            <dt>Access</dt>
            <dd>{recipe.ask.access}</dd>
            {Object.keys(recipe.inputs).length > 0 && (
              <>
                <dt>Inputs</dt>
                <dd>
                  {Object.keys(recipe.inputs).map((name, index) => (
                    <Fragment key={name}>
                      {index > 0 && ", "}
                      <code>{name}</code>
                    </Fragment>
                  ))}{" "}
                  in <code>metadata.with</code>
                </dd>
              </>
            )}
          </dl>
        </Fragment>
      ))}
    </>
  );
}
