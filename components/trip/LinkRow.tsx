import type { OutLink } from "@/lib/links";
import { External, Pin } from "../Icons";

const isMap = (l: OutLink) => l.url.startsWith("https://www.google.com/maps");

/** A row of outbound links. They open in a new tab so the trip board stays put. */
export function LinkRow({ links, label }: { links: OutLink[]; label?: string }) {
  return (
    <div className="link-row" role="group" aria-label={label}>
      {links.map((l) => (
        <a key={l.label} className="link-chip" href={l.url} target="_blank" rel="noopener noreferrer">
          {isMap(l) ? <Pin size={15} /> : <External size={15} />}
          {l.label}
        </a>
      ))}
    </div>
  );
}
