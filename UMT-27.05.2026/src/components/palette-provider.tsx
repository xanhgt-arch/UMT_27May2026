import * as React from "react";

/**
 * Palette provider — swaps the six `--chart-*` CSS variables on
 * `document.documentElement` so every Recharts chart picks up the new
 * colours without a re-render. Each palette ships a light and a dark
 * variant; we re-apply on theme change so dark mode keeps its lighter L.
 */

export type PaletteId =
  | "brand"
  | "brand2"
  | "ocean"
  | "sunset"
  | "forest"
  | "mono"
  | "vivid";

type Swatches = readonly [string, string, string, string, string, string];

export type PaletteDef = {
  id: PaletteId;
  name: string;
  description: string;
  light: Swatches;
  dark: Swatches;
};

export const PALETTES: readonly PaletteDef[] = [
  {
    id: "brand",
    name: "Cooper Standard",
    description: "Brand blue → gold",
    light: [
      "oklch(0.43 0.17 256)",
      "oklch(0.58 0.15 250)",
      "oklch(0.72 0.13 230)",
      "oklch(0.75 0.14 65)",
      "oklch(0.83 0.16 88)",
      "oklch(0.62 0.13 75)",
    ],
    dark: [
      "oklch(0.72 0.14 256)",
      "oklch(0.78 0.12 248)",
      "oklch(0.82 0.11 230)",
      "oklch(0.82 0.15 65)",
      "oklch(0.85 0.16 88)",
      "oklch(0.70 0.13 75)",
    ],
  },
  {
    // Same brand story, but blue + yellow lead so two-segment charts
    // (e.g. CATIA vs NX) always render as the canonical blue/yellow pair.
    // Remaining slots fall back into the brand family on either side.
    id: "brand2",
    name: "Cooper Standard 2",
    description: "Blue + yellow lead",
    light: [
      "oklch(0.43 0.17 256)", // brand blue (deep)
      "oklch(0.83 0.16 88)",  // brand gold / yellow
      "oklch(0.58 0.15 250)", // mid blue
      "oklch(0.75 0.14 65)",  // warm amber
      "oklch(0.72 0.13 230)", // sky blue
      "oklch(0.62 0.13 75)",  // deep bronze
    ],
    dark: [
      "oklch(0.72 0.14 256)",
      "oklch(0.85 0.16 88)",
      "oklch(0.78 0.12 248)",
      "oklch(0.82 0.15 65)",
      "oklch(0.82 0.11 230)",
      "oklch(0.70 0.13 75)",
    ],
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Cool blues & teals",
    light: [
      "oklch(0.42 0.13 230)",
      "oklch(0.55 0.13 215)",
      "oklch(0.66 0.12 200)",
      "oklch(0.74 0.12 185)",
      "oklch(0.78 0.11 170)",
      "oklch(0.62 0.10 245)",
    ],
    dark: [
      "oklch(0.74 0.12 230)",
      "oklch(0.78 0.12 215)",
      "oklch(0.82 0.11 200)",
      "oklch(0.84 0.11 185)",
      "oklch(0.86 0.10 170)",
      "oklch(0.72 0.10 245)",
    ],
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm reds → ambers",
    light: [
      "oklch(0.55 0.18 25)",
      "oklch(0.62 0.17 45)",
      "oklch(0.70 0.16 65)",
      "oklch(0.78 0.15 85)",
      "oklch(0.74 0.16 15)",
      "oklch(0.60 0.15 350)",
    ],
    dark: [
      "oklch(0.74 0.17 25)",
      "oklch(0.78 0.16 45)",
      "oklch(0.82 0.15 65)",
      "oklch(0.86 0.14 85)",
      "oklch(0.80 0.15 15)",
      "oklch(0.74 0.14 350)",
    ],
  },
  {
    id: "forest",
    name: "Forest",
    description: "Greens & earth tones",
    light: [
      "oklch(0.45 0.13 150)",
      "oklch(0.58 0.13 140)",
      "oklch(0.68 0.12 125)",
      "oklch(0.72 0.11 100)",
      "oklch(0.65 0.10 75)",
      "oklch(0.55 0.09 55)",
    ],
    dark: [
      "oklch(0.72 0.13 150)",
      "oklch(0.78 0.13 140)",
      "oklch(0.82 0.12 125)",
      "oklch(0.84 0.11 100)",
      "oklch(0.78 0.10 75)",
      "oklch(0.72 0.09 55)",
    ],
  },
  {
    id: "mono",
    name: "Mono blue",
    description: "Single-hue blue ramp",
    light: [
      "oklch(0.34 0.13 256)",
      "oklch(0.46 0.14 256)",
      "oklch(0.58 0.14 256)",
      "oklch(0.68 0.12 256)",
      "oklch(0.78 0.10 256)",
      "oklch(0.86 0.07 256)",
    ],
    dark: [
      "oklch(0.55 0.14 256)",
      "oklch(0.64 0.14 256)",
      "oklch(0.72 0.13 256)",
      "oklch(0.78 0.11 256)",
      "oklch(0.84 0.09 256)",
      "oklch(0.90 0.06 256)",
    ],
  },
  {
    id: "vivid",
    name: "Vivid",
    description: "High-contrast multi-hue",
    light: [
      "oklch(0.55 0.20 265)",
      "oklch(0.62 0.20 25)",
      "oklch(0.68 0.18 140)",
      "oklch(0.72 0.18 75)",
      "oklch(0.58 0.20 320)",
      "oklch(0.62 0.16 195)",
    ],
    dark: [
      "oklch(0.74 0.18 265)",
      "oklch(0.78 0.18 25)",
      "oklch(0.80 0.16 140)",
      "oklch(0.84 0.16 75)",
      "oklch(0.76 0.18 320)",
      "oklch(0.78 0.14 195)",
    ],
  },
];

const PALETTE_IDS = PALETTES.map((p) => p.id);
const DEFAULT_PALETTE: PaletteId = "brand2";

function isPaletteId(value: string | null): value is PaletteId {
  return value !== null && (PALETTE_IDS as string[]).includes(value);
}

function currentMode(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyPalette(id: PaletteId) {
  const def = PALETTES.find((p) => p.id === id) ?? PALETTES[0]!;
  const swatches = currentMode() === "dark" ? def.dark : def.light;
  const root = document.documentElement.style;
  swatches.forEach((color, i) => {
    root.setProperty(`--chart-${i + 1}`, color);
  });
}

type PaletteContextValue = {
  palette: PaletteId;
  setPalette: (next: PaletteId) => void;
  palettes: readonly PaletteDef[];
};

const PaletteContext = React.createContext<PaletteContextValue | undefined>(undefined);

const STORAGE_KEY = "umt-palette";

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = React.useState<PaletteId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPaletteId(stored) ? stored : DEFAULT_PALETTE;
  });

  // Apply on mount and whenever selection changes.
  React.useEffect(() => {
    applyPalette(palette);
  }, [palette]);

  // Re-apply when the `.dark` class on <html> flips, so light/dark variants
  // of the same palette swap in automatically.
  React.useEffect(() => {
    const observer = new MutationObserver(() => applyPalette(palette));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [palette]);

  const setPalette = React.useCallback((next: PaletteId) => {
    localStorage.setItem(STORAGE_KEY, next);
    setPaletteState(next);
  }, []);

  const value = React.useMemo<PaletteContextValue>(
    () => ({ palette, setPalette, palettes: PALETTES }),
    [palette, setPalette],
  );

  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}

export function usePalette(): PaletteContextValue {
  const ctx = React.useContext(PaletteContext);
  if (!ctx) throw new Error("usePalette must be used within PaletteProvider");
  return ctx;
}
