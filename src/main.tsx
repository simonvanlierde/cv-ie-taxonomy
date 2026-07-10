import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CvTaxonomy } from "./CvTaxonomy";
import "./demo.css";

// Demo-only deep links: ?theme=dark|light forces a theme, ?cell=<id> opens a
// panel, ?p=0.5 pins scroll progress (dev screenshots).
const params = new URLSearchParams(window.location.search);
const theme = params.get("theme");
const pParam = params.get("p");
// keep the demo shell's over-scroll background in step with a forced theme
if (theme === "dark" || theme === "light") {
  document.body.style.backgroundColor = theme === "dark" ? "#0b1622" : "#dce8f1";
}

const root = document.getElementById("root");
if (!root) throw new Error("index.html is missing #root");

createRoot(root).render(
  <StrictMode>
    <CvTaxonomy
      theme={theme === "dark" || theme === "light" ? theme : undefined}
      initialCell={params.get("cell") ?? undefined}
      debugProgress={pParam ? Number(pParam) : undefined}
    />
  </StrictMode>,
);
