// A screenshot framed in the page: a neutral window bar labelled with the
// product, a rounded edge, a soft shadow and a caption. The frame is not in
// the image, so the image is the window's content and nothing else.
//
// An editor shot comes in two captures, `light` and `dark`, and the page shows
// the one that matches the site's theme. A platform's own screen, such as
// Azure Data Factory's, has one capture in its own theme: give it as `src`,
// with the `label` it needs and the date it was `checked` against the
// platform, which ends the caption. A platform shot is cropped to its subject
// and shown at its own size, never larger, in a frame no wider than the
// image, and links to the image to open it full size.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ScreenshotScroll } from "@/components/screenshot-scroll";

/** A PNG's size in pixels, from its header: the build fails if the file is missing. */
function pngSize(source: string): { width: number; height: number } {
  const header = readFileSync(join(process.cwd(), "public", source)).subarray(0, 24);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** `2026-11-04` as `4 November 2026`; a day the month does not have, such as `2026-02-31`, is refused. */
export function checkedOn(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const [year, month, day] = match ? match.slice(1).map(Number) : [0, 0, 0];
  const real = new Date(Date.UTC(year, month - 1, day));
  if (
    !match ||
    real.getUTCFullYear() !== year ||
    real.getUTCMonth() !== month - 1 ||
    real.getUTCDate() !== day
  ) {
    throw new Error(`Screenshot: checked must be a date such as 2026-11-04, not "${date}"`);
  }
  return `${day} ${months[month - 1]} ${year}`;
}

type Captures =
  | { light: string; dark: string; src?: undefined }
  | { src: string; light?: undefined; dark?: undefined };

/**
 * One framed screenshot.
 * @example <Screenshot light="/images/vscode/editor-light.png" dark="/images/vscode/editor-dark.png" caption="…" />
 * @example <Screenshot src="/images/adf/pipeline.png" label="Azure Data Factory" checked="2026-11-04" caption="…" />
 */
export function Screenshot({
  caption,
  alt,
  label,
  checked,
  ...captures
}: Captures & {
  /** Says what the image shows. */
  caption: string;
  /** Describes the image for a reader who cannot see it; the caption when left out. */
  alt?: string;
  /** The window bar's label: the product, such as "Azure Data Factory". A platform's screen (`src`) needs it; an editor shot's is VS Code's. */
  label?: string;
  /** The date the screen was last checked, such as `2026-11-04`; it ends the caption. A platform's screen (`src`) needs it. */
  checked?: string;
}) {
  const images: { src: string; className?: string }[] =
    captures.src !== undefined
      ? [{ src: captures.src }]
      : [
          { src: captures.light, className: "screenshot-light" },
          { src: captures.dark, className: "screenshot-dark" },
        ];
  if (captures.src !== undefined && (captures.light || captures.dark)) {
    throw new Error("Screenshot: give src, or light and dark, not both");
  }
  if (images.some((image) => !image.src)) {
    throw new Error("Screenshot: give src, or both light and dark");
  }
  const platform = captures.src !== undefined;
  if (platform && !checked) {
    throw new Error(
      `Screenshot: ${captures.src} needs the date it was checked, such as 2026-11-04`,
    );
  }
  if (platform && !label) {
    throw new Error(`Screenshot: ${captures.src} needs the label of the product it shows`);
  }
  const bar = label ?? "VS Code · Ingestron";
  const sizes = images.map((image) => pngSize(image.src));
  const [size] = sizes;
  if (sizes.some((other) => other.width !== size.width || other.height !== size.height)) {
    throw new Error(`Screenshot: ${captures.light} and ${captures.dark} differ in size`);
  }
  const text = checked ? `${caption} Checked on ${checkedOn(checked)}.` : caption;
  const name = alt ?? caption;
  const shown = images.map((image) => (
    <img
      key={image.src}
      className={image.className}
      src={image.src}
      alt={name}
      width={size.width}
      height={size.height}
      loading="lazy"
      decoding="async"
    />
  ));
  return (
    <figure className={platform ? "screenshot screenshot-platform" : "screenshot"}>
      <div className="screenshot-frame">
        <div className="screenshot-bar" aria-hidden="true">
          <span className="screenshot-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="screenshot-label">{bar}</span>
        </div>
        {/* On a narrow screen the image keeps a readable size and scrolls in a
            frame named after the shot, which takes focus only while it scrolls. */}
        <ScreenshotScroll label={name}>
          {/* With two captures, the page shows one of them with CSS, as it does the logo. */}
          {platform ? (
            <a
              className="screenshot-open"
              href={captures.src}
              aria-label={`Open full size: ${name}`}
            >
              {shown}
            </a>
          ) : (
            shown
          )}
        </ScreenshotScroll>
      </div>
      <figcaption>{text}</figcaption>
    </figure>
  );
}
