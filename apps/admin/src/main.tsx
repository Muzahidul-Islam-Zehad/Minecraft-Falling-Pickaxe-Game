import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/**
 * Phase 1 admin shell (master spec §6): must start independently.
 * Phase 10 builds the real dashboard.
 */

 
console.info("[admin] Phase 1 shell — Phase 10 implements the dashboard");

function App() {
  return (
    <main style={{ fontFamily: "monospace", padding: 16, color: "#cfd8dc" }}>
      <h1 style={{ fontSize: 20 }}>Minecraft Endless Fall — Admin</h1>
      <p>Phase 1 shell. The dashboard arrives in Phase 10.</p>
    </main>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
