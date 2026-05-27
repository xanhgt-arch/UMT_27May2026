import { PageHeader } from "@/components/layout/PageHeader";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { MonthlyUsageTotal, MONTHLY_TOTAL_FILTER } from "@/components/dashboard/charts/MonthlyUsageTotal";
import { MonthlyHeatmap, MONTHLY_HEATMAP_FILTER } from "@/components/dashboard/charts/MonthlyHeatmap";
import { YearHeatmap, YEAR_HEATMAP_FILTER } from "@/components/dashboard/charts/YearHeatmap";
import { AppCompare, APP_COMPARE_FILTER } from "@/components/dashboard/charts/AppCompare";
import { ApplicationDonut, APP_DONUT_FILTER } from "@/components/dashboard/charts/ApplicationDonut";
import { ApplicationBars, APP_BARS_FILTER } from "@/components/dashboard/charts/ApplicationBars";
import {
  ApplicationFunctionality,
  APP_FUNCTIONALITY_FILTER,
} from "@/components/dashboard/charts/ApplicationFunctionality";
import { CadBars, CAD_BARS_FILTER } from "@/components/dashboard/charts/CadBars";
import { CadVsAppMatrix, CAD_MATRIX_FILTER } from "@/components/dashboard/charts/CadVsAppMatrix";
import { RegionBars, REGION_BARS_FILTER } from "@/components/dashboard/charts/RegionBars";
import { RegionMonthly, REGION_MONTHLY_FILTER } from "@/components/dashboard/charts/RegionMonthly";
import { DomainList, DOMAIN_LIST_FILTER } from "@/components/dashboard/charts/DomainList";
import {
  FluidsSealingsSplit,
  FLUIDS_SEALING_FILTER,
} from "@/components/dashboard/charts/FluidsSealingsSplit";

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Each chart answers a single question about Cooper Standard KBE tool usage and carries its own filter chips — tweak any card without touching the others."
      />

      <div className="space-y-4">
        <ChartCard
          title="How many KBE tool runs per month?"
          description="Monthly KBE tool runs, split by CAD platform. Toggle between bar and line view to compare totals at a glance."
          filter={MONTHLY_TOTAL_FILTER}
          filterStyle="chips"
        >
          <MonthlyUsageTotal />
        </ChartCard>

        <ChartCard
          title="Which months are busiest for KBE tools?"
          description="A single colored tile per month, scaled by total tool runs. Spot the year's busy and quiet stretches at a glance."
          filter={YEAR_HEATMAP_FILTER}
          filterStyle="chips"
        >
          <YearHeatmap />
        </ChartCard>

        <ChartCard
          title="When during the year are KBE tools run?"
          description="A day-by-month heatmap of tool runs. Darker cells mark busier days; the row under each column sums the month."
          filter={MONTHLY_HEATMAP_FILTER}
          filterStyle="chips"
        >
          <MonthlyHeatmap />
        </ChartCard>

        <ChartCard
          title="How do two KBE tools compare month by month?"
          description="Pick any two KBE tools to plot their monthly run counts side by side."
          filter={APP_COMPARE_FILTER}
          filterStyle="chips"
        >
          <AppCompare />
        </ChartCard>

        <ChartCard
          title="Which KBE tools are run most?"
          description="The top six KBE tools by total runs in the selected window."
          filter={APP_DONUT_FILTER}
          filterStyle="chips"
        >
          <ApplicationDonut />
        </ChartCard>

        <ChartCard
          title="What are engineers doing inside each KBE tool?"
          description="A breakdown of runs by activity type for the busiest tools."
          filter={APP_BARS_FILTER}
          filterStyle="chips"
        >
          <ApplicationBars />
        </ChartCard>

        <ChartCard
          title="Which functionality is used most in each KBE tool?"
          description="Pick a KBE tool to see its top functionalities, ranked by run count."
          filter={APP_FUNCTIONALITY_FILTER}
          filterStyle="chips"
        >
          <ApplicationFunctionality />
        </ChartCard>

        <ChartCard
          title="Which CAD platform hosts the most KBE tool runs?"
          description="Tool runs grouped by CAD platform, sorted from most-used to least-used."
          filter={CAD_BARS_FILTER}
          filterStyle="chips"
        >
          <CadBars />
        </ChartCard>

        <ChartCard
          title="How do top KBE tools differ across CAD platforms?"
          description="The five busiest KBE tools, plotted against each CAD platform."
          filter={CAD_MATRIX_FILTER}
          filterStyle="chips"
        >
          <CadVsAppMatrix />
        </ChartCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Where in the world are KBE tools run?"
            description="Tool runs by region for the selected period."
            filter={REGION_BARS_FILTER}
            filterStyle="chips"
          >
            <RegionBars />
          </ChartCard>
          <ChartCard
            title="Which engineering domain runs the most KBE tools?"
            description="Tool runs grouped by engineering domain, ranked from highest to lowest."
            filter={DOMAIN_LIST_FILTER}
            filterStyle="chips"
          >
            <DomainList />
          </ChartCard>
        </div>

        <ChartCard
          title="How does regional KBE usage trend across the year?"
          description="Monthly run counts split by region — switch between stacked totals, side-by-side bars, or trend lines."
          filter={REGION_MONTHLY_FILTER}
          filterStyle="chips"
        >
          <RegionMonthly />
        </ChartCard>

        <ChartCard
          title="Fluids vs Sealings tool runs"
          description="How KBE tool runs split across the two main product lines."
          filter={FLUIDS_SEALING_FILTER}
          filterStyle="chips"
        >
          <FluidsSealingsSplit />
        </ChartCard>
      </div>
    </div>
  );
}
