import { useEffect, useState, type ReactNode } from "react";
import { num } from "@/lib/format";

/**
 * Shared "smart segment label" renderers for stacked Recharts bars.
 *
 * Behaviour:
 *   - If the segment is big enough to fit the value comfortably, render
 *     the value inside, centered, in `insideFill` (white by default).
 *   - Otherwise pop the value out of the segment as a callout in the
 *     segment's own colour, with a short leader line back to it.
 *
 * Two variants:
 *   - `segmentLabelVertical`   — for vertical bar segments. Fit check is
 *     based on segment **height**; the callout slides to the right of
 *     the bar with a horizontal leader.
 *   - `segmentLabelHorizontal` — for horizontal bar segments. Fit check
 *     is based on segment **width**; the callout pops above the bar
 *     with an L-shaped leader.
 *
 * Used by RegionBars, RegionMonthly, MonthlyUsageTotal, ApplicationBars
 * so tiny segments (e.g. 16 sessions next to 3,340) stay readable
 * without overlapping their neighbours.
 */

type Opts = {
  /** Colour for the callout text + leader when the label pops out. */
  color: string;
  /** Text colour when the label fits inside the segment. Defaults to white. */
  insideFill?: string;
};

type SegmentLabelProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: ReactNode;
};

/**
 * Colour tokens whose default fill is too light for white text inside the
 * segment — switch to the foreground colour (near-black in light mode, near-
 * white in dark mode) so the label remains readable on gold / amber fills.
 */
const LIGHT_FILL_TOKENS = new Set([
  "var(--chart-2)",  // brand gold  (L 0.83 / 0.85)
  "var(--chart-4)",  // warm amber  (L 0.75 / 0.82)
  "var(--brand-gold)",
]);

/**
 * Resolve any CSS colour expression (named token, `var(--x)`, `oklch(...)`,
 * `#hex`, gradient strings — anything you can put in `background-color`) to
 * the concrete RGB the browser would actually paint. We do this by mounting
 * a 1×1 hidden probe div, letting the engine compute its `background-color`
 * (which always comes back as `rgb(...)` or `rgba(...)`), then reading it.
 *
 * SSR-safe: returns the input untouched when `document` isn't available.
 * Results are cached so the probe runs once per unique colour, not per slice.
 * The cache is flushed whenever the theme class on `<html>` toggles, so
 * dark-mode swaps don't leave us with stale light-mode RGB values.
 */
const RESOLVED_CACHE = new Map<string, string>();
let CACHE_OBSERVER_INSTALLED = false;
let paletteVersion = 0;
const paletteSubscribers = new Set<() => void>();

function bumpPaletteVersion(): void {
  paletteVersion += 1;
  RESOLVED_CACHE.clear();
  paletteSubscribers.forEach((cb) => cb());
}

function ensureCacheInvalidation(): void {
  if (CACHE_OBSERVER_INSTALLED) return;
  if (typeof window === "undefined" || typeof document === "undefined") return;
  // PaletteProvider applies its colour overrides via
  // `documentElement.style.setProperty('--chart-N', …)` inside a post-mount
  // useEffect — so the first chart render reads the still-stock palette and
  // then white-text-on-yellow gets stuck until something else triggers a
  // re-render. Watching `<html>`'s `class` / `style` / `data-theme` and
  // bumping a version number lets the `usePaletteVersion()` hook force the
  // affected charts to re-render the moment the palette actually applies.
  const observer = new MutationObserver(bumpPaletteVersion);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });
  CACHE_OBSERVER_INSTALLED = true;
}

/**
 * Returns a number that increments whenever the live chart palette mutates
 * on `<html>` (theme toggles, PaletteProvider re-applying chart-* vars).
 * Charts that derive text/fill colours from the palette should call this so
 * they re-render after the post-mount palette swap.
 */
export function usePaletteVersion(): number {
  const [v, setV] = useState(paletteVersion);
  useEffect(() => {
    ensureCacheInvalidation();
    // Force one tick after mount in case PaletteProvider's own effect
    // applied between render and our subscription.
    setV((prev) => (prev === paletteVersion ? prev + 1 : paletteVersion));
    const cb = () => setV(paletteVersion);
    paletteSubscribers.add(cb);
    return () => {
      paletteSubscribers.delete(cb);
    };
  }, []);
  return v;
}

function resolveColor(color: string): string {
  if (!color || typeof color !== "string") return color;
  if (typeof window === "undefined" || typeof document === "undefined") return color;
  ensureCacheInvalidation();
  const cached = RESOLVED_CACHE.get(color);
  if (cached !== undefined) return cached;
  let probe: HTMLDivElement | null = null;
  try {
    probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;pointer-events:none;visibility:hidden;";
    probe.style.backgroundColor = color;
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).backgroundColor.trim();
    const out = computed || color;
    RESOLVED_CACHE.set(color, out);
    return out;
  } catch {
    return color;
  } finally {
    if (probe && probe.parentNode) probe.parentNode.removeChild(probe);
  }
}

/** Relative luminance (0..1) for an sRGB triplet. */
function srgbLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * True when the supplied colour is bright enough that white text washes out.
 * Handles named CSS tokens (resolved via getComputedStyle), raw `oklch(L C H)`,
 * `rgb()/rgba()`, and `#hex` strings. Threshold is tuned so brand-gold (gold
 * yellow), warm amber, and any custom palette swap to a high-lightness fill
 * all trip the check and get dark text inside the slice.
 */
export function isLightFill(color: string): boolean {
  if (LIGHT_FILL_TOKENS.has(color)) return true;
  const resolved = resolveColor(color);

  const oklch = resolved.match(/oklch\(\s*([0-9.]+)/i);
  if (oklch) {
    const L = parseFloat(oklch[1]!);
    if (Number.isFinite(L) && L >= 0.6) return true;
  }

  const rgb = resolved.match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);
  if (rgb) {
    const r = parseFloat(rgb[1]!);
    const g = parseFloat(rgb[2]!);
    const b = parseFloat(rgb[3]!);
    if (srgbLuminance(r, g, b) >= 0.45) return true;
  }

  const hex = resolved.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1]!;
    const full = h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if (srgbLuminance(r, g, b) >= 0.45) return true;
  }

  return false;
}

/**
 * Pick a text colour that stays readable on top of `bgColor`. Returns the
 * theme's foreground (near-black light / near-white dark) for light fills,
 * white for everything else.
 */
export function pickTextOnFill(bgColor: string): string {
  return isLightFill(bgColor) ? "var(--foreground)" : "#ffffff";
}

function autoInsideFill(color: string): string {
  return isLightFill(color) ? "var(--foreground)" : "#ffffff";
}

function normalise(opts: Opts | string): Required<Opts> {
  if (typeof opts === "string") {
    return { color: opts, insideFill: autoInsideFill(opts) };
  }
  return { color: opts.color, insideFill: opts.insideFill ?? autoInsideFill(opts.color) };
}

/** For vertical stacked bars (segment height drives the fit check). */
export function segmentLabelVertical(opts: Opts | string) {
  const { insideFill } = normalise(opts);
  return (props: SegmentLabelProps) => {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const width = Number(props.width ?? 0);
    const height = Number(props.height ?? 0);
    const v = Number(props.value ?? 0);
    if (!v) return null;

    const text = num(v);

    if (height >= 14) {
      // Use the `style` property (not the `fill` attribute) so any CSS
      // var() references in the inside fill resolve — SVG attributes
      // don't expand var(...).
      return (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fontWeight={600}
          pointerEvents="none"
          style={{ fill: insideFill }}
        >
          {text}
        </text>
      );
    }

    const anchorX = x + width;
    const anchorY = y + height / 2;
    const labelX = x + width + 10;
    return (
      <g pointerEvents="none">
        <path
          d={`M${anchorX},${anchorY} L${labelX - 3},${anchorY}`}
          fill="none"
          style={{ stroke: "var(--foreground)" }}
          strokeWidth={1}
          strokeOpacity={0.75}
        />
        <text
          x={labelX}
          y={anchorY}
          textAnchor="start"
          dominantBaseline="central"
          fontSize={11}
          fontWeight={700}
          style={{ fill: "var(--foreground)" }}
        >
          {text}
        </text>
      </g>
    );
  };
}

/** For horizontal stacked bars (segment width drives the fit check). */
export function segmentLabelHorizontal(opts: Opts | string) {
  const { insideFill } = normalise(opts);
  return (props: SegmentLabelProps) => {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const width = Number(props.width ?? 0);
    const height = Number(props.height ?? 0);
    const v = Number(props.value ?? 0);
    if (!v) return null;

    const text = num(v);
    // ~6.6 px per char at 12 px font + a little padding.
    const approxTextWidth = text.length * 6.6 + 10;

    if (width >= approxTextWidth) {
      // Use the `style` property (not the `fill` attribute) so any CSS
      // var() references in the inside fill resolve — SVG attributes
      // don't expand var(...).
      return (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontWeight={600}
          pointerEvents="none"
          style={{ fill: insideFill }}
        >
          {text}
        </text>
      );
    }

    const anchorX = x + width / 2;
    const labelX = x + width + 6;
    const elbowY = y - 8;
    const labelY = y - 10;
    return (
      <g pointerEvents="none">
        <path
          d={`M${anchorX},${y} L${anchorX},${elbowY} L${labelX - 3},${elbowY}`}
          fill="none"
          style={{ stroke: "var(--foreground)" }}
          strokeWidth={1}
          strokeOpacity={0.75}
        />
        <text
          x={labelX}
          y={labelY}
          textAnchor="start"
          dominantBaseline="auto"
          fontSize={11}
          fontWeight={700}
          style={{ fill: "var(--foreground)" }}
        >
          {text}
        </text>
      </g>
    );
  };
}
