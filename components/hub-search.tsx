"use client";
// The home page's search field: a button that opens the site's search dialog,
// as the header's search does.
import { useSearchContext } from "fumadocs-ui/contexts/search";

export function HubSearch() {
  const { setOpenSearch, hotKey } = useSearchContext();
  return (
    <button type="button" className="hub-search" onClick={() => setOpenSearch(true)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <span>Search guides, connectors, settings and errors</span>
      <span className="hub-search-keys" aria-hidden="true">
        {hotKey.map((key, index) => (
          <kbd key={index}>{key.display}</kbd>
        ))}
      </span>
    </button>
  );
}
