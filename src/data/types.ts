// Types for the CV-in-IE taxonomy. The single source of truth is taxonomy.json,
// which mirrors Paper 2, Table S2. Do not change verdicts here. Change the draft,
// then the JSON.

export type Scale = "Product" | "Component" | "Material";
export type InfoType = "Identity" | "Quantity" | "Structure" | "Condition";

export type Verdict =
  | "Strong"
  | "Partial"
  | "Emerging-but-narrow"
  | "Plausible-but-unvalidated"
  | "Absent";

export type SourceStatus = "Published" | "Preprint" | "Mixed" | "n/a";

export interface SubVerdict {
  label: string;
  maturity: Verdict;
  rubricMarks: string;
}

export interface Cell {
  id: string;
  scale: Scale;
  informationType: InfoType;
  task: string;
  methodFamily: string | null;
  maturity: Verdict;
  maturityNote: string;
  /** Present only for compound cells (e.g. Component·Structure). */
  subVerdicts?: SubVerdict[];
  rubricMarks: string;
  hardware: string | null;
  failureMode: string | null;
  example: string | null;
  citations: string[];
  sourceStatus: SourceStatus;
  /** Product·Structure and Material·Structure: resolved at component scale. */
  structurallyEmpty?: boolean;
}

export interface MaturityLevel {
  verdict: Verdict;
  letter: string;
  gloss: string;
  handling: string;
}

export interface Taxonomy {
  meta: {
    title: string;
    subtitle: string;
    source: string;
    scanDate: string;
    axes: { scale: Scale[]; informationType: InfoType[] };
    maturityLevels: MaturityLevel[];
  };
  product: {
    name: string;
    note: string;
    components: string[];
    materials: string[];
  };
  cells: Cell[];
}
