// The literature layer. Citation keys are the paper's, and references.json is
// generated from the paper's reference manager — a reference changes there and
// is regenerated, never edited by hand here.
//
// Two surfaces, one source: a chip inside a cell's detail panel that opens the
// full reference in place (native popover, so it escapes the panel's scroll box),
// and the alphabetical list at the foot of the page.

import { useId } from "react";
import raw from "./data/references.json";
import { cells } from "./data/taxonomy";

export interface Reference {
  key: string;
  /** APA in-text form: "Liu et al., 2025d". */
  short: string;
  /** Full APA 7 entry; *asterisks* mark the italic runs. */
  apa: string;
  url: string;
}

export const REFERENCES = raw as Reference[];
const BY_KEY = new Map(REFERENCES.map((r) => [r.key, r]));

/** Which matrix cells each reference backs — the drawing's index, read the other
 *  way round. Derived, so it cannot drift from taxonomy.json. */
const CITED_BY = new Map<string, string[]>();
for (const c of cells) {
  for (const key of c.citations) {
    CITED_BY.set(key, [...(CITED_BY.get(key) ?? []), `${c.scale} · ${c.informationType}`]);
  }
}

/** Renders the *italic* runs of a generated APA string. */
function apaText(apa: string) {
  // biome-ignore lint/suspicious/noArrayIndexKey: a reference string is static data — the split never reorders
  return apa.split("*").map((part, i) => (i % 2 ? <em key={`${i}-${part}`}>{part}</em> : part));
}

function doiLabel(url: string) {
  return url.replace(/^https?:\/\//, "");
}

/** One citation in a detail panel: the APA in-text form, opening the full entry. */
export function Cite({ citeKey }: { citeKey: string }) {
  // the same cell can be on screen twice (Explorable's inline panel and the
  // dialog), so the ids are per-instance, not per-key
  const uid = useId().replace(/[^\w-]/g, "");
  const ref = BY_KEY.get(citeKey);
  // an unknown key means references.json is stale — show the key rather than nothing
  if (!ref) return <span className="cvt-cite-key">@{citeKey}</span>;

  const popId = `cvt-cite-${uid}`;
  // the anchor name has to be unique per chip, so it rides in on a custom
  // property; the CSS reads it as both anchor-name and position-anchor
  const anchor = { "--cite-anchor": `--anchor-${uid}` };
  return (
    <>
      <button type="button" className="cvt-cite-chip" popoverTarget={popId} style={anchor}>
        {ref.short}
      </button>
      <div id={popId} popover="auto" className="cvt-cite-pop" style={anchor}>
        <p className="cvt-cite-apa">{apaText(ref.apa)}</p>
        <p className="cvt-cite-meta">
          <span className="cvt-mono">@{ref.key}</span>
          {ref.url && (
            <a href={ref.url} target="_blank" rel="noreferrer">
              {doiLabel(ref.url)}
            </a>
          )}
        </p>
      </div>
    </>
  );
}

/** The page's reference list: every source behind a verdict, and which cells it backs. */
export function ReferenceList() {
  return (
    <section className="cvt-refs" aria-labelledby="cvt-refs-title">
      <p className="cvt-eyebrow">
        <span className="cvt-dot" aria-hidden /> Sources
      </p>
      <h2 id="cvt-refs-title">References</h2>
      <p className="cvt-refs-lede">
        Every verdict in the matrix is anchored to published work. Each entry lists the cells it
        backs; the key is the one used in the paper.
      </p>
      <ol className="cvt-reflist">
        {REFERENCES.map((r) => (
          <li key={r.key} id={`cvt-ref-${r.key}`}>
            <p className="cvt-ref-apa">{apaText(r.apa)}</p>
            <p className="cvt-ref-meta">
              <span className="cvt-ref-key">@{r.key}</span>
              <span className="cvt-ref-cells">{(CITED_BY.get(r.key) ?? []).join(", ")}</span>
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer">
                  {doiLabel(r.url)}
                </a>
              )}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
