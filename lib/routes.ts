// Where a project's data can go: the DuckDB starter, then every route New
// project offers. Titles, `--via` values and packs come from the CLI; what
// each route is for, and its guide, are written here, and a route the CLI
// adds without them fails the build.
import { builtInTemplates, sampleFacts } from "@ingestron/cli";
import { allRoutes, routePacks } from "@/lib/reference";

/** One way to start a project, and what it gives you. */
export interface RouteRow {
  /** The route's `--via`, or the starter's template name. */
  id: string;
  title: string;
  /** How `ingestron init` asks for it: `--via databricks` or `--template duckdb`. */
  option: string;
  packs: string[];
  /** The guide's path under `/docs/`. */
  guide: string;
  choose: string;
  afterLoad: string;
  deploy: string;
  /** The section that says how to deploy it, or run it where there is nothing to deploy. */
  deployAt: string;
  /** That section's heading. */
  deployStep: string;
}

/** The guide for each route, by its `--via` value. */
export const routeGuides: Record<string, string> = {
  databricks: "platforms/databricks",
  "adf-databricks": "platforms/adf",
  "adf-synapse": "platforms/synapse",
  "adf-duckdb": "platforms/duckdb-in-azure",
  "adf-landing": "platforms/landing-only",
};

/** The starter that needs no source and no cloud. */
export const starter = "duckdb";

type Written = Pick<RouteRow, "choose" | "afterLoad" | "deploy" | "deployAt" | "deployStep">;

/** What each route is for, in the docs' words, by `--via` (or the starter's name). */
const written: Record<string, Written> = {
  [starter]: {
    choose: "To try Ingestron, or to build tables from files on one machine, with no cloud.",
    afterLoad:
      "You run `run.sql` with the DuckDB command line: it rebuilds the tables and publishes them as Parquet.",
    deploy: "Nothing. It runs where you are.",
    deployAt: "/docs/start/first-project#4-build-the-tables",
    deployStep: "Build the tables",
  },
  databricks: {
    choose: "Databricks can reach the source, and the tables live in Databricks.",
    afterLoad: "Nothing more. The Databricks pipeline that reads the source writes the tables.",
    deploy: "The Databricks CLI: `databricks bundle deploy`.",
    deployAt: "/docs/platforms/databricks#deploy",
    deployStep: "Deploy the bundle",
  },
  "adf-databricks": {
    choose:
      "ADF copies the source, for example through a self-hosted integration runtime on a private network, and the tables live in Databricks.",
    afterLoad: "Databricks pipelines read the landed files into tables, on their own schedule.",
    deploy: "The factory's Git publishing for ADF, and `databricks bundle deploy`.",
    deployAt: "/docs/platforms/adf#publish",
    deployStep: "Publish the factory",
  },
  "adf-synapse": {
    choose:
      "Reports need SQL over the copied tables, with nothing to run or store after each load.",
    afterLoad: "Nothing. Synapse serverless SQL reads the files each time a report queries a view.",
    deploy:
      "The factory's Git publishing, and running `views.sql` against the serverless database when the definitions change.",
    deployAt: "/docs/platforms/synapse#deploy",
    deployStep: "Deploy",
  },
  "adf-duckdb": {
    choose:
      "You want DuckDB tables, published as Parquet, rebuilt in Azure from the copied tables, and the same tables on a laptop.",
    afterLoad:
      "A Container Apps job you create runs the DuckDB SQL in Ingestron's public runner image; ADF can start it after the copies.",
    deploy: "The factory's Git publishing, and copying the DuckDB folder to storage.",
    deployAt: "/docs/platforms/duckdb-in-azure#deploy-the-sql",
    deployStep: "Deploy the SQL",
  },
  "adf-landing": {
    choose: "Reports read the landed files themselves, such as Power BI reading Parquet.",
    afterLoad: "Nothing. The copied files are the result.",
    deploy: "The factory's Git publishing.",
    deployAt: "/docs/platforms/landing-only#deploy",
    deployStep: "Deploy",
  },
};

function words(id: string): Written {
  const found = written[id];
  if (!found) throw new Error(`No description for the route "${id}" in lib/routes.ts.`);
  return found;
}

function guide(via: string): string {
  const found = routeGuides[via];
  if (!found) throw new Error(`No guide for the route "${via}".`);
  return found;
}

/** The DuckDB starter, then every route New project offers, in its order. */
export function routeRows(): RouteRow[] {
  const template = builtInTemplates().find((item) => item.name === starter);
  if (!template) throw new Error(`No built-in template "${starter}".`);
  return [
    {
      id: starter,
      title: template.title,
      option: `--template ${starter}`,
      packs: sampleFacts(template.folder).packs.map((pack) => pack.split("@")[0]!),
      guide: "platforms/duckdb",
      ...words(starter),
    },
    ...allRoutes().map(({ via, title }) => ({
      id: via,
      title,
      option: `--via ${via}`,
      packs: routePacks(via),
      guide: guide(via),
      ...words(via),
    })),
  ];
}

/** One route's row, by its `--via` value or the starter's name. */
export function routeRow(id: string): RouteRow {
  const row = routeRows().find((item) => item.id === id);
  if (!row) throw new Error(`No route "${id}".`);
  return row;
}

/** The command that creates a project from a connector on one route; `init` asks for the rest. */
export function connectorCommand(connector: string, via: string): string {
  return `ingestron init sales --connector ${connector} --via ${via}`;
}

/** The command that creates a project from a built-in starter; `init` asks the starter's questions. */
export function starterCommand(template: string): string {
  return `ingestron init ${template === starter ? "shop" : "sales"} --template ${template}`;
}
