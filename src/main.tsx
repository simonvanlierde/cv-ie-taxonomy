import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CvTaxonomy } from "./CvTaxonomy";
import { parseScene } from "./params";

// Deep links: ?theme=dark|light forces a theme, ?cell=<id> opens a
// panel, ?scene=0..4 pins a scene (dev screenshots).
const params = new URLSearchParams(window.location.search);
const theme = params.get("theme");

const root = document.getElementById("root");
if (!root) throw new Error("index.html is missing #root");

createRoot(root).render(
  <StrictMode>
    <CvTaxonomy
      theme={theme === "dark" || theme === "light" ? theme : undefined}
      initialCell={params.get("cell") ?? undefined}
      debugChapter={parseScene(params.get("scene"))}
    />
  </StrictMode>,
);
