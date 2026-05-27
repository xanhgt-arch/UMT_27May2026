import type { ComponentType, ReactNode } from "react";

/**
 * Pill-shaped chart-type switcher styled to match the global filter-chip
 * range selector ("cooper theme 2"): white container with a subtle border,
 * active option painted brand blue, and an on-brand gold hover wash on the
 * inactive options.
 */
export type ChartShapeOption<T extends string> = {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  ariaLabel?: string;
};

type Props<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: readonly ChartShapeOption<T>[];
  ariaLabel?: string;
  className?: string;
};

export function ChartShapeToggle<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: Props<T>): ReactNode {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={[
        "inline-flex items-center gap-1 rounded-full border border-border bg-card p-1",
        className ?? "",
      ].join(" ")}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.ariaLabel ?? opt.label}
            onClick={() => {
              if (!active) onChange(opt.value);
            }}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-[oklch(0.83_0.16_88_/_0.22)] hover:text-foreground dark:hover:bg-[oklch(0.83_0.16_88_/_0.25)]",
            ].join(" ")}
          >
            {Icon ? <Icon className="size-3.5" /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
