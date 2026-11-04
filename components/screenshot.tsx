// A screenshot framed in the page: a neutral window bar labelled with the
// product, a rounded edge, a soft shadow and a caption. The frame is not in
// the image, so the image is the window's content and nothing else.
//
// An editor shot comes in two captures, `light` and `dark`, and the page shows
// the one that matches the site's theme. A platform's own screen, such as
// Azure Data Factory's, has one capture in its own theme: give it as `src`,
// with the `label` it needs and the date it was `checked` against the
// platform, which ends the caption.
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
  label = "VS Code · Ingestron",
  checked,
  ...captures
}: Captures & {
  /** Says what the image shows. */
  caption: string;
  /** Describes the image for a reader who cannot see it; the caption when left out. */
  alt?: string;
  /** The window bar's label. */
  label?: string;
  /** The date the screen was last checked, such as `2026-11-04`; it ends the caption. */
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
  const sizes = images.map((image) => pngSize(image.src));
  const [size] = sizes;
  if (sizes.some((other) => other.width !== size.width || other.height !== size.height)) {
    throw new Error(`Screenshot: ${captures.light} and ${captures.dark} differ in size`);
  }
  const text = checked ? `${caption} Checked on ${checkedOn(checked)}.` : caption;
  return (
    <figure className="screenshot">
      <div className="screenshot-frame">
        <div className="screenshot-bar" aria-hidden="true">
          <span className="screenshot-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="screenshot-label">{label}</span>
        </div>
        {/* On a narrow screen the image keeps a readable size and scrolls in a
            frame named after the shot, which takes focus only while it scrolls. */}
        <ScreenshotScroll label={alt ?? caption}>
          {/* With two captures, the page shows one of them with CSS, as it does the logo. */}
          {images.map((image) => (
            <img
              key={image.src}
              className={image.className}
              src={image.src}
              alt={alt ?? caption}
              width={size.width}
              height={size.height}
              loading="lazy"
              decoding="async"
            />
          ))}
        </ScreenshotScroll>
      </div>
      <figcaption>{text}</figcaption>
    </figure>
  );
}
