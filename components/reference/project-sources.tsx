// Discovery uses the same metadata as the CLI and New project wizard. Headings
// are MDX's own, so a jump to a category clears the sticky header.
import { projectSources, projectRoutes } from "@ingestron/core";
import { Heading } from "fumadocs-ui/components/heading";
import { categoryAnchor, sourceCategories } from "@/lib/connector-page";

/** Every source, under a heading per category, with the routes it can take.
 * @example <ProjectSources />
 */
export function ProjectSources() {
  const sources = projectSources();
  return sourceCategories().map((name) => (
    <div key={name}>
      <Heading as="h2" id={categoryAnchor(name)}>
        {name}
      </Heading>
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
