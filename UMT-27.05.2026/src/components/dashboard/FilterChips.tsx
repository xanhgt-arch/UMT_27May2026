import { useState } from "react";
import {
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
import { useFilters, DEFAULT_FILTERS } from "@/lib/filter-context";
import {
  APPLICATIONS,
  CAD_TOOLS,
  HARDWARE_KINDS,
  PRODUCT_LINES,
  REGIONS,
  TECH_DOMAINS,
} from "@/lib/mock-data";
import type { Hardware, RangePreset } from "@/lib/types";

const RANGES: { id: RangePreset; label: string }[] = [
  { id: "currentMonth", label: "This month" },
  { id: "lastMonth",    label: "Last month" },
  { id: "thisYear",     label: "This year" },
  { id: "lastYear",     label: "Last year" },
  { id: "custom",       label: "Custom" },
];

/**
 * Multi-select chip. `selected` is the current array; an empty array means
 * "no filter" (all values pass). Clicking an option toggles its presence;
 * the "All" row at the top clears the selection.
 */
function MultiChipPopover({
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

function CustomRangePopover() {
  const { global, setGlobal } = useFilters();
  const [from, setFrom] = useState(global.customFrom ?? "");
  const [to, setTo] = useState(global.customTo ?? "");

  return (
    <Popover>
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
            onClick={() =>
              setGlobal({
                range: "custom",
                customFrom: from || undefined,
                customTo: to || undefined,
              })
            }
            
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

export function FilterChips() {
  const { global, setGlobal, resetGlobal } = useFilters();

  const dirty =
    global.range !== DEFAULT_FILTERS.range ||
    global.application.length > 0 ||
    global.cad.length > 0 ||
    global.productLine.length > 0 ||
    global.region.length > 0 ||
    global.domain.length > 0 ||
    global.hardware.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
        <CalendarDays className="ml-2 size-4 text-muted-foreground" />
        {RANGES.map((r) =>
          r.id === "custom" && global.range === "custom" ? (
            <CustomRangePopover key={r.id} />
          ) : (
            <button
              key={r.id}
              type="button"
              onClick={() =>
                r.id === "custom"
                  ? setGlobal({ range: "custom" })
                  : setGlobal({ range: r.id, customFrom: undefined, customTo: undefined })
              }
              className={[
                "rounded-full px-3 py-1 text-sm transition-colors",
                global.range === r.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-[oklch(0.83_0.16_88_/_0.22)] hover:text-foreground dark:hover:bg-[oklch(0.83_0.16_88_/_0.25)]",
              ].join(" ")}
            >
              {r.label}
            </button>
          ),
        )}
      </div>

      <Separator orientation="vertical" className="hidden h-6 md:block" />

      <MultiChipPopover
        icon={Layers}
        label="Tool"
        options={APPLICATIONS.map((a) => a.name)}
        selected={global.application}
        onChange={(v) => setGlobal({ application: v })}
        allLabel="All KBE tools"
      />
      <MultiChipPopover
        icon={Cpu}
        label="CAD"
        options={CAD_TOOLS}
        selected={global.cad}
        onChange={(v) => setGlobal({ cad: v })}
        allLabel="All CAD tools"
      />
      <MultiChipPopover
        icon={Package}
        label="Product"
        options={PRODUCT_LINES}
        selected={global.productLine}
        onChange={(v) => setGlobal({ productLine: v })}
        allLabel="All product lines"
      />
      <MultiChipPopover
        icon={Globe2}
        label="Region"
        options={REGIONS}
        selected={global.region}
        onChange={(v) => setGlobal({ region: v })}
        allLabel="All regions"
      />
      <MultiChipPopover
        icon={Network}
        label="Domain"
        options={TECH_DOMAINS}
        selected={global.domain}
        onChange={(v) => setGlobal({ domain: v })}
        allLabel="All domains"
      />
      <MultiChipPopover
        icon={MonitorSmartphone}
        label="Hardware"
        options={HARDWARE_KINDS}
        selected={global.hardware}
        onChange={(v) => setGlobal({ hardware: v as Hardware[] })}
        allLabel="All hardware"
      />

      {dirty ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetGlobal}
          className="h-9 gap-1.5 rounded-full text-xs text-muted-foreground"
        >
          <RotateCcw className="size-3.5" />
          Reset all
        </Button>
      ) : null}
    </div>
  );
}
