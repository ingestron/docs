// Discovery uses the same metadata as the CLI and New project wizard.
import { projectSources, projectRoutes } from "@ingestron/cli";
import { categoryAnchor, sourceCategories } from "@/lib/connector-page";

/** Every source, under a heading per category, with the routes it can take.
 * @example <ProjectSources />
 */
export function ProjectSources() {
  const sources = projectSources();
  return sourceCategories().map((name) => (
    <div key={name}>
      <h2 id={categoryAnchor(name)}>{name}</h2>
      <SourceList sources={sources.filter((source) => source.category === name)} />
    </div>
  ));
}

function SourceList({ sources }: { sources: ReturnType<typeof projectSources> }) {
  return (
    <ul className="source-list">
      {sources.map((source) => (
        <li key={source.id}>
          <a href={`/docs/connectors/${source.id}`}>{source.title}</a>
          <span>
            {projectRoutes(source.id)
              .map((route) => `${route.title}: ${route.connectivity.join(", ")}`)
              .join(" · ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
