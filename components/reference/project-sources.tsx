// Discovery uses the same metadata as the CLI and New project wizard. Headings
// are MDX's own, so a jump to a category clears the sticky header.
import { projectSources, projectRoutes } from "@ingestron/core";
import { Heading } from "fumadocs-ui/components/heading";
import { categoryAnchor, sourceCategories } from "@/lib/connector-page";
import { platformById, type Platform } from "@/lib/platforms";

/** Every source a platform loads, under a heading per category, with the routes it can take there.
 * @example <ProjectSources platform="synapse" />
 */
export function ProjectSources({ platform }: { platform: Platform["id"] }) {
  const routes = platformById(platform).routes;
  const sources = projectSources().filter((source) =>
    projectRoutes(source.id).some((route) => routes.includes(route.via)),
  );
  return sourceCategories()
    .filter((name) => sources.some((source) => source.category === name))
    .map((name) => (
      <div key={name}>
        <Heading as="h2" id={categoryAnchor(name)}>
          {name}
        </Heading>
        <SourceList
          platform={platform}
          sources={sources.filter((source) => source.category === name)}
        />
      </div>
    ));
}

function SourceList({
  platform,
  sources,
}: {
  platform: Platform["id"];
  sources: ReturnType<typeof projectSources>;
}) {
  const routes = platformById(platform).routes;
  return (
    <ul className="source-list">
      {sources.map((source) => (
        <li key={source.id}>
          <a href={`/docs/${platform}/connectors/${source.id}`}>{source.title}</a>
          <span>
            {projectRoutes(source.id)
              .filter((route) => routes.includes(route.via))
              .map((route) => `${route.title}: ${route.connectivity.join(", ")}`)
              .join(" · ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
