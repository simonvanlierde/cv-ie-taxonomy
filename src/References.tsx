// The literature layer: every citation is an author–year chip that opens the
// full APA entry in a native popover, with the DOI link inside it. One surface,
// used both in a panel's source row and inline in its prose. Citation keys stay
// internal — they are a reference-manager artifact, never shown to the reader.
//
// references.json mirrors the paper's reference library: corrections land in
// the library first, then here.

import { type ReactNode, useId } from "react";
import raw from "./data/references.json";

export interface Reference {
  key: string;
  /** APA in-text form: "Sterkens et al., 2023". */
  short: string;
  /** Full APA 7 entry; *asterisks* mark the italic runs. */
  apa: string;
  url: string;
}

export const REFERENCES = raw as Reference[];
const BY_KEY = new Map(REFERENCES.map((r) => [r.key, r]));

/** Renders the *italic* runs of a generated APA string. */
function apaText(apa: string) {
  // biome-ignore lint/suspicious/noArrayIndexKey: a reference string is static data — the split never reorders
  return apa.split("*").map((part, i) => (i % 2 ? <em key={`${i}-${part}`}>{part}</em> : part));
}

function doiLabel(url: string) {
  return url.replace(/^https?:\/\//, "");
}

/** First author's surname from an APA in-text form, skipping leading initials
 *  ("J. Liu et al., 2025" → "Liu"). */
const surnameOf = (r: Reference) =>
  r.short.split(/[\s,]+/).find((t) => !/^[A-ZÀ-Ž]\.$/.test(t)) ?? "";

const yearOf = (r: Reference) => /\d{4}/.exec(r.short)?.[0] ?? "";

/** A citation chip: the author–year form, opening the full APA entry and its
 *  DOI link in a popover. `label` keeps the surrounding prose's own wording
 *  when the chip sits inline. */
export function Cite({ citeKey, label }: { citeKey: string; label?: string }) {
  // the same cell can be on screen twice (Explorable's inline detail and the
  // dialog), so the popover ids are per-instance, not per-key
  const uid = useId().replace(/[^\w-]/g, "");
  const ref = BY_KEY.get(citeKey);
  // References.test.tsx guarantees every taxonomy key resolves
  if (!ref) return label ?? null;

  const popId = `cvt-cite-${uid}`;
  // the anchor name has to be unique per chip, so it rides in on a custom
  // property; the CSS reads it as both anchor-name and position-anchor
  const anchor = { "--cite-anchor": `--anchor-${uid}` };
  return (
    <>
      <button type="button" className="cvt-cite-chip" popoverTarget={popId} style={anchor}>
        {label ?? ref.short}
      </button>
      <div id={popId} popover="auto" className="cvt-cite-pop" style={anchor}>
        <p className="cvt-cite-apa">{apaText(ref.apa)}</p>
        {ref.url && (
          <p className="cvt-cite-meta">
            <a href={ref.url} target="_blank" rel="noreferrer">
              {doiLabel(ref.url)}
            </a>
          </p>
        )}
      </div>
    </>
  );
}

/** Prose with its author–year mentions turned into citation chips. Each mention
 *  is matched to one of the cell's own citations by first-author surname and
 *  year, consuming them in citation order so two same-named mentions ("Liu et
 *  al. 2025" twice) land on distinct references. A mention whose year the
 *  library disagrees with (a stale preprint date) falls back to the surname
 *  alone when that is unambiguous; anything unmatched stays plain text. */
export function CitedProse({ text, citeKeys }: { text: string; citeKeys: readonly string[] }) {
  const pool = citeKeys.map((k) => BY_KEY.get(k)).filter((r): r is Reference => r !== undefined);
  const parts: ReactNode[] = [];
  let last = 0;
  const mentions = text.matchAll(
    /([A-ZÀ-Ž][\w'’-]+(?: et al\.| & [A-ZÀ-Ž][\w'’-]+)?),? (\d{4})\b/g,
  );
  for (const m of mentions) {
    const surname = m[1]?.split(" ")[0];
    let i = pool.findIndex((r) => surnameOf(r) === surname && yearOf(r) === m[2]);
    if (i < 0) {
      const sameName = pool.filter((r) => surnameOf(r) === surname);
      if (sameName.length === 1 && sameName[0]) i = pool.indexOf(sameName[0]);
    }
    const ref = pool[i];
    if (i < 0 || !ref) continue;
    pool.splice(i, 1);
    parts.push(
      text.slice(last, m.index),
      <Cite key={`${ref.key}-${m.index}`} citeKey={ref.key} label={m[0]} />,
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}
