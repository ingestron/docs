// An anchor a section had before it moved or was renamed, kept so that links
// made to it still land. A browser cannot redirect a fragment, so the old id
// stays on the page: on the section's new heading, or on the sentence that
// links to the fact's new home.
/**
 * An empty target with an old id, placed just before the heading or text it
 * now stands for. It scrolls to the same place a heading would.
 * @example <OldAnchor id="generate-then-run-the-views" />
 */
export function OldAnchor({ id }: { id: string }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`OldAnchor: "${id}" is not an anchor such as generate-and-publish`);
  }
  return <span id={id} className="old-anchor" aria-hidden="true" />;
}
