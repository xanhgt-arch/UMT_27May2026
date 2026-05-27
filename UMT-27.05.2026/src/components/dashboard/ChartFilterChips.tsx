import { useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  Check,
  Cpu,
  Globe2,
  Layers,
  MonitorSmartphone,
  Network,
  Package,
  RotateCcw,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useChartFilters, DEFAULT_FILTERS } from "@/lib/filter-context";
import {
  APPLICATIONS,
  CAD_TOOLS,
  HARDWARE_KINDS,
  PRODUCT_LINES,
  REGIONS,
  SESSION_STATUSES,
  TECH_DOMAINS,
} from "@/lib/mock-data";
import type {
  ChartFilterOverride,
  FilterDim,
  Hardware,
  RangePreset,
  SessionStatus,
} from "@/lib/types";

const RANGES: { id: RangePreset; label: string }[] = [
  { id: "currentMonth", label: "This month" },
  { id: "lastMonth",    label: "Last month" },
  { id: "thisYear",     label: "This year" },
  { id: "lastYear",     label: "Last year" },
  { id: "custom",       label: "Custom" },
];

type DimConfig = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  allLabel: string;
  options: readonly string[];
};

const DIM_CONFIG: Record<Exclude<FilterDim, "range">, DimConfig> = {
  application: { icon: Layers,            label: "Tool",     allLabel: "All KBE tools",     options: APPLICATIONS.map((a) => a.name) },
  cad:         { icon: Cpu,               label: "CAD",      allLabel: "All CAD tools",     options: CAD_TOOLS },
  productLine: { icon: Package,           label: "Product",  allLabel: "All product lines", options: PRODUCT_LINES },
  region:      { icon: Globe2,            label: "Region",   allLabel: "All regions",       options: REGIONS },
  domain:      { icon: Network,           label: "Domain",   allLabel: "All domains",       options: TECH_DOMAINS },
  hardware:    { icon: MonitorSmartphone, label: "Hardware", allLabel: "All hardware",      options: HARDWARE_KINDS },
  status:      { icon: Activity,          label: "Status",   allLabel: "All statuses",      options: SESSION_STATUSES },
};

export function MultiChipPopover({
  icon: Icon,
  label,
  options,
  selected,
  onChange,
  allLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  options: readonly string[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  allLabel: string;
}) {
  const count = selected.length;
  let display: string;
  if (count === 0) display = allLabel;
  else if (count === 1) display = selected[0];
  else display = `${count} selected`;

  const isActive = count > 0;

  function toggle(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter((v) => v !== opt));
    } else {
      onChange([...selected, opt]);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={[
            "h-9 gap-2 rounded-full font-normal transition-colors",
            isActive
              ? "border-[oklch(0.43_0.17_256_/_0.45)] bg-[oklch(0.43_0.17_256_/_0.06)]"
              : "",
          ].join(" ")}
        >
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{label}:</span>
          <span className="font-medium">{display}</span>
          {count > 1 ? (
            <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          <li>
            <button
              type="button"
              onClick={() => onChange([])}
              className={[
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm",
                count === 0
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              {count === 0 ? allLabel : "Clear selection"}
              {count === 0 ? <span className="size-1.5 rounded-full bg-primary" /> : null}
            </button>
          </li>
          {options.length > 0 ? (
            <li aria-hidden className="mx-2 my-1 h-px bg-border" />
          ) : null}
          {options.map((opt) => {
            const on = selected.includes(opt);
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => toggle(opt)}
                  aria-pressed={on}
                  className={[
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm",
                    on
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-muted",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={[
                        "grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background",
                      ].join(" ")}
                    >
                      {on ? <Check className="size-3" /> : null}
                    </span>
                    {opt}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function CustomRangePopover({
  initialFrom,
  initialTo,
  onApply,
}: {
  initialFrom: string;
  initialTo: string;
  onApply: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setFrom(initialFrom);
      setTo(initialTo);
    }
  }, [open, initialFrom, initialTo]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground"
        >
          Custom
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-lg"
            />
          </div>
          <Button
            size="sm"
            className="w-full rounded-lg"
            onClick={() => {
              onApply(from, to);
              setOpen(false);
            }}
            
            disabled={
              !from ||
              !to ||
              new Date(from).getTime() > new Date(to).getTime()
            }

          >
            Apply range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Per-chart filter chips. Same visual language as the global <FilterChips />,
 * but writes to chart-specific override state via useChartFilters(). Only the
 * dimensions listed in `applicable` are shown.
 */
export function ChartFilterChips({
  chartId,
  applicable,
  prefixSlot,
}: {
  chartId: string;
  applicable: readonly FilterDim[];
  prefixSlot?: React.ReactNode;
}) {
  const { effective, setOverride, reset } = useChartFilters(chartId, applicable);

  const includesRange = applicable.includes("range");
  const dimChips = applicable.filter(
    (d): d is Exclude<FilterDim, "range"> => d !== "range",
  );

  const dirty =
    (includesRange &&
      (effective.range !== DEFAULT_FILTERS.range ||
        Boolean(effective.customFrom) ||
        Boolean(effective.customTo))) ||
    dimChips.some((d) => (effective[d] as readonly string[]).length > 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {prefixSlot}
      {includesRange ? (
        <>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <CalendarDays className="ml-2 size-4 text-muted-foreground" />
            {RANGES.map((r) =>
              r.id === "custom" && effective.range === "custom" ? (
                <CustomRangePopover
                  key={r.id}
                  initialFrom={effective.customFrom ?? ""}
                  initialTo={effective.customTo ?? ""}
                  onApply={(from, to) =>
                    setOverride({
                      range: "custom",
                      customFrom: from || undefined,
                      customTo: to || undefined,
                    })
                  }
                />
              ) : (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    r.id === "custom"
                      ? setOverride({ range: "custom" })
                      : setOverride({
                          range: r.id,
                          customFrom: undefined,
                          customTo: undefined,
                        })
                  }
                  className={[
                    "rounded-full px-3 py-1 text-sm transition-colors",
                    effective.range === r.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-[oklch(0.83_0.16_88_/_0.22)] hover:text-foreground dark:hover:bg-[oklch(0.83_0.16_88_/_0.25)]",
                  ].join(" ")}
                >
                  {r.label}
                </button>
              ),
            )}
          </div>

          {dimChips.length > 0 ? (
            <Separator orientation="vertical" className="hidden h-6 md:block" />
          ) : null}
        </>
      ) : null}

      {dimChips.map((dim) => {
        const cfg = DIM_CONFIG[dim];
        const selected = effective[dim] as readonly string[];
        return (
          <MultiChipPopover
            key={dim}
            icon={cfg.icon}
            label={cfg.label}
            options={cfg.options}
            selected={selected}
            onChange={(next) => {
              if (dim === "hardware") {
                setOverride({ hardware: next as Hardware[] });
              } else if (dim === "status") {
                setOverride({ status: next as SessionStatus[] });
              } else {
                setOverride({ [dim]: next } as ChartFilterOverride);
              }
            }}
            allLabel={cfg.allLabel}
          />
        );
      })}

      {dirty ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="h-9 gap-1.5 rounded-full text-xs text-muted-foreground"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      ) : null}
    </div>
  );
}
