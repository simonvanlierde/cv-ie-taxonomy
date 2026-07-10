import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CvTaxonomy } from "./CvTaxonomy";
import "./demo.css";

// Demo-only deep links: ?theme=dark|light forces a theme, ?cell=<id> opens a
// panel, ?p=0.5 pins scroll progress (dev screenshots). The component owns the
// page background from here on, so nothing writes body styles by hand.
const params = new URLSearchParams(window.location.search);
const theme = params.get("theme");
const pParam = params.get("p");

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
