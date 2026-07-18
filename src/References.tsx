// The literature layer, kept to two quiet surfaces: an author–year link in a
// cell's detail panel that goes straight to the source, and the alphabetical
// list at the foot of the page. Citation keys stay internal — they are a
// reference-manager artifact, never shown to the reader.
//
// references.json mirrors the paper's reference library: corrections land in
// the library first, then here.

import { memo } from "react";
import raw from "./data/references.json";
import { cells } from "./data/taxonomy";

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

/** Which matrix cells each reference backs — the drawing's index, read the other
 *  way round. Derived, so it cannot drift from taxonomy.json. */
const CITED_BY = new Map<string, string[]>();
for (const c of cells) {
  for (const key of c.citations) {
    const backs = CITED_BY.get(key) ?? [];
    CITED_BY.set(key, backs);
    backs.push(`${c.scale} · ${c.informationType}`);
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

/** One citation in a detail panel: the APA in-text form, linking to the source. */
export function Cite({ citeKey }: { citeKey: string }) {
  const ref = BY_KEY.get(citeKey);
  // References.test.tsx guarantees every taxonomy key resolves
  if (!ref) return null;
  return (
    <a
      className="cvt-cite-link"
      href={ref.url}
      target="_blank"
      rel="noreferrer"
      title={ref.apa.replace(/\*/g, "")}
    >
      {ref.short}
    </a>
  );
}

/** The page's reference list: the sources behind the verdicts, and which cells each backs. */
export const ReferenceList = memo(function ReferenceList() {
  return (
    <section className="cvt-refs" aria-labelledby="cvt-refs-title">
      <p className="cvt-eyebrow">
        <span className="cvt-dot" aria-hidden /> Sources
      </p>
      <h2 id="cvt-refs-title">References</h2>
      <p className="cvt-refs-lede">
        The sources behind the verdicts, each with the matrix cells it backs. Some are still
        preprints; the cell&rsquo;s panel says which.
      </p>
      <ol className="cvt-reflist">
        {REFERENCES.map((r) => (
          <li key={r.key}>
            <p className="cvt-ref-apa">{apaText(r.apa)}</p>
            <p className="cvt-ref-meta">
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
});
