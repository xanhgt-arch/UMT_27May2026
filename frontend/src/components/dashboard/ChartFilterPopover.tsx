import { Check, SlidersHorizontal, RotateCcw } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useChartFilters } from "@/lib/filter-context";
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

const DIM_LABEL: Record<FilterDim, string> = {
  range:       "Date range",
  application: "KBE tool",
  cad:         "CAD platform",
  productLine: "Product line",
  region:      "Region",
  domain:      "Domain",
  hardware:    "Hardware",
  status:      "Status",
};

const DIM_OPTIONS: Record<Exclude<FilterDim, "range">, readonly string[]> = {
  application: APPLICATIONS.map((a) => a.name),
  cad:         CAD_TOOLS,
  productLine: PRODUCT_LINES,
  region:      REGIONS,
  domain:      TECH_DOMAINS,
  hardware:    HARDWARE_KINDS,
  status:      SESSION_STATUSES,
};

const RANGE_OPTIONS: { id: RangePreset; label: string }[] = [
  { id: "currentMonth", label: "Current month" },
  { id: "lastMonth",    label: "Last month" },
  { id: "thisYear",     label: "This year" },
  { id: "lastYear",     label: "Last year" },
];

export function ChartFilterPopover({
  chartId,
  applicable,
}: {
  chartId: string;
  applicable: readonly FilterDim[];
}) {
  const { effective, overrideCount, setOverride, reset } =
    useChartFilters(chartId, applicable);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 rounded-full px-3 text-xs"
          aria-label={`Filter — ${chartId}`}
        >
          <SlidersHorizontal className="size-3.5" />
          Filter
          {overrideCount > 0 ? (
            <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {overrideCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Filter this chart</h4>
          {overrideCount > 0 ? (
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" /> Reset
            </button>
          ) : null}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Overrides the page-level filter, just for this card. Pick multiple
          values per dimension.
        </p>
        <Separator className="mb-3" />

        <div className="space-y-3">
          {applicable.map((dim) => {
            if (dim === "range") {
              return (
                <div key={dim} className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {DIM_LABEL[dim]}
                  </span>
                  <Select
                    value={effective.range}
                    onValueChange={(v) =>
                      setOverride({ range: v as RangePreset })
                    }
                  >
                    <SelectTrigger className="h-9 w-full rounded-lg">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {RANGE_OPTIONS.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            const options = DIM_OPTIONS[dim];
            const selected = effective[dim] as readonly string[];
            return (
              <MultiRow
                key={dim}
                label={DIM_LABEL[dim]}
                options={options}
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
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Inline multi-select row used inside the per-chart filter popover. Each
 * option toggles independently; clicking "All" clears the selection.
 */
function MultiRow({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter((v) => v !== opt));
    } else {
      onChange([...selected, opt]);
    }
  }
  const count = selected.length;
  const summary =
    count === 0 ? `All ${label.toLowerCase()}` :
    count === 1 ? selected[0] :
                  `${count} selected`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground/80">{summary}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-background p-2">
        <button
          type="button"
          onClick={() => onChange([])}
          className={[
            "rounded-full px-2.5 py-0.5 text-xs transition-colors",
            count === 0
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          ].join(" ")}
        >
          All
        </button>
        {options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              aria-pressed={on}
              className={[
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs transition-colors",
                on
                  ? "bg-[oklch(0.43_0.17_256_/_0.10)] text-[#0E4DA1] ring-1 ring-[oklch(0.43_0.17_256_/_0.45)] dark:text-primary"
                  : "border border-border text-muted-foreground hover:border-[oklch(0.83_0.16_88_/_0.45)] hover:text-foreground",
              ].join(" ")}
            >
              {on ? <Check className="size-3" /> : null}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
