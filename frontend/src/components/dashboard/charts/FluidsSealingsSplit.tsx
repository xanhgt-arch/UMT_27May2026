import { useMemo } from "react";
import { SplitDonut } from "./SplitDonut";
import { useChartFilters } from "@/lib/filter-context";
import { filterFluidsSealingsSplit } from "@/lib/filtering";
import type { FilterDim } from "@/lib/types";

export const FLUIDS_SEALING_FILTER: { id: string; applicable: readonly FilterDim[] } = {
  id: "fluidsSealingsSplit",
  applicable: ["range", "application", "cad", "productLine", "region", "domain", "hardware"],
};

export function FluidsSealingsSplit() {
  const { effective } = useChartFilters(
    FLUIDS_SEALING_FILTER.id,
    FLUIDS_SEALING_FILTER.applicable,
  );
  const data = useMemo(() => filterFluidsSealingsSplit(effective), [effective]);

  if (data.length === 0) {
    return (
      <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">
        No Fluids or Sealings data matches the current filter.
      </div>
    );
  }

  return (
    <SplitDonut
      data={data}
      primaryLabel="Tool runs"
      colors={["var(--chart-1)", "var(--chart-2)"]}
    />
  );
}
