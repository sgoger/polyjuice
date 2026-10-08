import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./index.css";
import { ensureCrossOriginIsolation } from "./isolation.ts";

if (import.meta.env.PROD) void ensureCrossOriginIsolation();

const root = document.getElementById("root");
if (!root) throw new Error("#root introuvable");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
