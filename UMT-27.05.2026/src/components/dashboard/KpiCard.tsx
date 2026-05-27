import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { num, signed } from "@/lib/format";

export type KpiCardProps = {
  label: string;
  value: number | string;
  delta?: number;
  deltaSuffix?: string;
  icon: LucideIcon;
  helpText?: string;
  /**
   * Secondary line shown below the value when there's no delta —
   * good for runner-ups ("2nd: Foo") or context ("47% of sessions").
   */
  caption?: string;
  /**
   * Visual accent applied to the icon tile. KPI grids alternate these
   * so the row reads as two-tone — echoing the blue + gold swoosh in
   * the Cooper Standard mark. Defaults to "blue".
   */
  accent?: "blue" | "gold";
};

export function KpiCard({
  label,
  value,
  delta,
  deltaSuffix,
  icon: Icon,
  helpText,
  caption,
  accent = "blue",
}: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  const isGold = accent === "gold";
  const isText = typeof value === "string";
  const displayValue = isText ? value : num(value);
  // Adapt the value's font size to the longest "word" in the string so
  // multi-word names (e.g. "POINT CHART") shrink to fit instead of being
  // truncated to "POINT CH…". Numbers always stay big.
  const longestWord = isText
    ? value.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0)
    : 0;
  const textSizeClass = !isText
    ? "text-3xl md:text-[34px]"
    : longestWord <= 6
      ? "text-2xl md:text-[26px]"
      : longestWord <= 9
        ? "text-xl md:text-[22px]"
        : longestWord <= 12
          ? "text-lg md:text-xl"
          : "text-base md:text-lg";
  return (
    <Card className="brand-edge-top card-hover overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div
              title={isText ? value : undefined}
              className={cn(
                "num mt-2 font-semibold tracking-tight",
                textSizeClass,
                // String values wrap (up to 2 lines) instead of truncating, so
                // long names like "POINT CHART" stay fully readable.
                isText ? "break-words leading-tight line-clamp-2" : undefined,
                // Brand-coloured value — the row reads as the swoosh
                // (blue, gold, blue, gold) before any number is parsed.
                isGold
                  ? "text-[color:oklch(0.55_0.13_82)] dark:text-[color:oklch(0.83_0.16_88)]"
                  : "text-[#0E4DA1] dark:text-primary",
              )}
            >
              {displayValue}
            </div>
          </div>
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl ring-1",
              isGold
                ? "bg-[oklch(0.83_0.16_88_/_0.16)] text-[oklch(0.55_0.13_82)] ring-[oklch(0.83_0.16_88_/_0.35)]"
                : "bg-primary/10 text-primary ring-primary/15",
            )}
          >
            <Icon className="size-[18px]" />
          </div>
        </div>

        {typeof delta === "number" ? (
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                positive
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300",
              )}
            >
              {positive ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              <span className="num">
                {signed(delta)}
                {deltaSuffix}
              </span>
            </span>
            <span className="text-muted-foreground">{helpText ?? "vs last month"}</span>
          </div>
        ) : caption ? (
          <div
            title={caption}
            className="mt-4 truncate text-xs text-muted-foreground"
          >
            {caption}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
