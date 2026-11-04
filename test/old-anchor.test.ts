// An old anchor a moved section keeps (components/old-anchor.tsx): an empty
// target with the old id, so links made to it still land.
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { OldAnchor } from "../components/old-anchor";

describe("an old anchor", () => {
  it("is an empty, hidden target with the old id", () => {
    expect(renderToStaticMarkup(createElement(OldAnchor, { id: "generate-and-publish" }))).toBe(
      '<span id="generate-and-publish" class="old-anchor" aria-hidden="true"></span>',
    );
  });

  it("refuses an id that is not an anchor", () => {
    expect(() => OldAnchor({ id: "#publish" })).toThrow('"#publish" is not an anchor');
    expect(() => OldAnchor({ id: "Publish the factory" })).toThrow("is not an anchor");
  });
});
