"use client";
// The site's main switch, in the header after the logo: the platform whose
// docs you are reading. Choosing one opens the same page on it (or that
// section's first page) and remembers it, so the product-wide pages keep
// showing its tabs. A button and a list of choices: arrows move between
// them, Enter chooses, Escape closes; with more than eight platforms a filter
// box and provider groups appear. The combinations come last, after a line,
// under "Combined" (lib/platforms.ts's pickerGroups).
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { rememberPlatform, rememberedPlatform } from "@/components/platform-choice";
import {
  manyPlatforms,
  pickerGroups,
  platformOfPath,
  platforms,
  singlePlatforms,
  switchTarget,
  type Platform,
  type Sites,
} from "@/lib/platforms";

/** The picker.
 * @example <PlatformPicker sites={siteSections(tree)} />
 */
export function PlatformPicker({ sites }: { sites: Sites }) {
  const path = usePathname() ?? "";
  const router = useRouter();
  const [chosen, setChosen] = useState<Platform["id"] | undefined>(platformOfPath(path));
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const list = useId();
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties>();

  // The page's platform, else the one chosen last.
  useEffect(() => {
    setChosen(platformOfPath(path) ?? (rememberedPlatform() as Platform["id"] | undefined));
  }, [path]);

  // The list is drawn over the page, outside the header, under the button and
  // inside the window, so no sticky bar covers it and it never runs off a phone.
  useEffect(() => {
    if (!open || !button.current) return;
    const at = () => {
      const rect = button.current!.getBoundingClientRect();
      const width = Math.min(352, window.innerWidth - 32);
      setPlace({
        top: rect.bottom + 6,
        left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)),
        width,
        // All the room below the button, so the combinations show too.
        maxHeight: window.innerHeight - rect.bottom - 22,
      });
    };
    at();
    window.addEventListener("resize", at);
    window.addEventListener("scroll", at, { passive: true });
    return () => {
      window.removeEventListener("resize", at);
      window.removeEventListener("scroll", at);
    };
  }, [open]);

  // Opening puts focus on the current choice; a click outside closes.
  useEffect(() => {
    if (!open || !place) return;
    const items = box.current?.querySelectorAll<HTMLElement>("[data-choice]");
    const current = box.current?.querySelector<HTMLElement>('[aria-current="true"]');
    (box.current?.querySelector<HTMLElement>("input") ?? current ?? items?.[0])?.focus();
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node) && event.target !== button.current)
        setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, place]);

  const choose = (id: Platform["id"]) => {
    rememberPlatform(id);
    setChosen(id);
    setOpen(false);
    const target = switchTarget(`${path}${window.location.hash}`, id, sites);
    if (target !== `${path}${window.location.hash}`) router.push(target);
    button.current?.focus();
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      // Close the list only: the menu or search behind it stays open.
      event.stopPropagation();
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...(box.current?.querySelectorAll<HTMLElement>("[data-choice]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? at + 1 : at - 1;
    items[(next + items.length) % items.length]?.focus();
  };

  const current = platforms.find((platform) => platform.id === chosen);
  const many = singlePlatforms.length > manyPlatforms;
  const groups = pickerGroups(filter);

  return (
    <div className="platform-picker">
      <button
        ref={button}
        type="button"
        className="platform-picker-button"
        aria-label={current ? `Platform: ${current.title}` : "Choose a platform"}
        aria-expanded={open}
        aria-controls={list}
        onClick={() => setOpen(!open)}
      >
        <span>{current ? current.title : "Choose a platform"}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open &&
        place &&
        createPortal(
          <div
            ref={box}
            id={list}
            className="platform-picker-list"
            style={place}
            onKeyDown={onKey}
            // Tabbing out of the list closes it, as leaving any dropdown does.
            onBlur={(event) => {
              const next = event.relatedTarget as Node | null;
              if (next && !box.current?.contains(next) && next !== button.current) setOpen(false);
            }}
          >
            {many && (
              <input
                type="search"
                aria-label="Filter platforms"
                placeholder="Filter platforms"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            )}
            {groups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label}>
                {group.separated && <hr className="platform-picker-separator" />}
                {(many || group.separated) && (
                  <p className="platform-picker-group">{group.label}</p>
                )}
                {group.items.map((platform) => (
                  <button
                    key={platform.id}
                    type="button"
                    data-choice
                    aria-current={platform.id === chosen ? "true" : undefined}
                    onClick={() => choose(platform.id)}
                  >
                    <strong>{platform.title}</strong>
                    <span>{platform.summary}</span>
                  </button>
                ))}
              </div>
            ))}
            {groups.length === 0 && <p className="platform-picker-none">No platform matches.</p>}
          </div>,
          document.body,
        )}
    </div>
  );
}
