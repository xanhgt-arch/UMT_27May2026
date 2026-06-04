import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App.tsx";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { PaletteProvider } from "@/components/palette-provider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="umt-theme">
      <PaletteProvider>
        <App />
      </PaletteProvider>
    </ThemeProvider>
  </StrictMode>,
);
