import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./index.css";
import { ensureCrossOriginIsolation } from "./isolation.ts";
import { detectLocale, setLocale } from "../i18n/index.ts";

if (import.meta.env.PROD) void ensureCrossOriginIsolation();

// Allemand si le navigateur est réglé en allemand, français sinon (modifiable ensuite dans la page).
setLocale(detectLocale(navigator.languages.length ? navigator.languages : [navigator.language]));

const root = document.getElementById("root");
if (!root) throw new Error("#root introuvable");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
