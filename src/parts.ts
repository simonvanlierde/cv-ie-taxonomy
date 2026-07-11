// Which fan part(s) each taxonomy cell is "about", for the explorable's linked
// fan highlight. Presentation only — not a claim, and NOT derived from taxonomy.json.
// Keys match Fan.tsx's part groups: fg front grille, bl blades, rg rear grille,
// mo motor, nk neck, ba base. `[]` = no single physical part (mass is derived;
// structure resolves at the component scale).
export type PartKey = "fg" | "bl" | "rg" | "mo" | "nk" | "ba";

export const PART_OF_CELL: Record<string, PartKey[]> = {
  "product-identity": ["ba"], // rating label / OCR lives on the base
  "product-quantity": ["fg", "ba"], // whole-object extent
  "product-structure": [], // resolves at the component scale
  "product-condition": ["ba"], // housing wear
  "component-identity": ["bl", "mo"], // detect parts
  "component-structure": ["rg", "bl", "mo"], // attachment relations
  "component-quantity": ["mo"], // motor dimensions
  "component-condition": ["mo"], // brush wear
  "material-identity": ["fg", "bl", "mo", "ba"], // steel · ABS · Cu · PCB
  "material-quantity": [], // mass is derived, never seen
  "material-structure": [], // resolves at the component scale
  "material-condition": ["mo"], // corrosion
};
