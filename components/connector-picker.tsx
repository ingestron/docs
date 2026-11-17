"use client";
// At the top of a platform's Connectors sidebar, which lists categories rather
// than every connector: type part of a source's name and choose it from the
// connectors that platform loads. A search box and a list of links, so the
// keyboard and screen readers use it as they use any links.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";

/** One connector a platform loads. */
export interface PickerEntry {
  id: string;
  title: string;
}

/**
 * The connectors whose name has a word starting with the query, or whose id
 * contains it; names that start with it first; at most ten.
 * @example connectorMatches(list, "sql") // SQL Server, Azure SQL Database, MySQL
 */
export function connectorMatches(list: PickerEntry[], query: string): PickerEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rank = (entry: PickerEntry) => {
    const title = entry.title.toLowerCase();
    if (title.startsWith(q)) return 0;
    if (title.split(/[\s/()-]+/).some((word) => word.startsWith(q))) return 1;
    if (entry.id.includes(q) || title.includes(q)) return 2;
    return 3;
  };
  return list
    .map((entry, index) => ({ entry, index, rank: rank(entry) }))
    .filter((item) => item.rank < 3)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, 10)
    .map((item) => item.entry);
}

/** The picker, on a platform's Connectors pages only.
 * @example <ConnectorPicker lists={{ synapse: [{ id: "sqlserver", title: "SQL Server" }], … }} />
 */
export function ConnectorPicker({ lists }: { lists: Record<string, PickerEntry[]> }) {
  const path = usePathname();
  const [query, setQuery] = useState("");
  const input = useId();
  const platform = /^\/docs\/([a-z]+)\/connectors(?:\/|$)/.exec(path ?? "")?.[1];
  const list = platform ? lists[platform] : undefined;
  if (!platform || !list) return null;
  const found = connectorMatches(list, query);
  return (
    <div className="connector-picker">
      <label htmlFor={input}>Find a connector</label>
      <input
        id={input}
        type="search"
        autoComplete="off"
        placeholder={`${list.length} sources`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-describedby="connector-picker-count"
      />
      <p id="connector-picker-count" className="sr-only" aria-live="polite">
        {query.trim() ? `${found.length} found` : ""}
      </p>
      {query.trim() !== "" && (
        <ul>
          {found.map((entry) => (
            <li key={entry.id}>
              <Link href={`/docs/${platform}/connectors/${entry.id}`}>{entry.title}</Link>
            </li>
          ))}
          {found.length === 0 && <li className="connector-picker-none">No source matches.</li>}
        </ul>
      )}
    </div>
  );
}
