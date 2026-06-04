import { Building2, CalendarDays, Globe2, Layers, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { ChartCard } from "@/components/dashboard/ChartCard"
import { ApplicationDataExportCard } from "@/components/dashboard/ApplicationDataExportCard"
import {
  ChartFilterChips,
  MultiChipPopover,
} from "@/components/dashboard/ChartFilterChips"
import {
  MonthlyUsageTotal,
  MONTHLY_TOTAL_FILTER,
} from "@/components/dashboard/charts/MonthlyUsageTotal"
import {
  MonthlyHeatmap,
  MONTHLY_HEATMAP_FILTER,
} from "@/components/dashboard/charts/MonthlyHeatmap"
import {
  YearHeatmap,
  YEAR_HEATMAP_FILTER,
} from "@/components/dashboard/charts/YearHeatmap"
import {
  AppCompare,
  APP_COMPARE_FILTER,
} from "@/components/dashboard/charts/AppCompare"
import {
  ApplicationDonut,
  APP_DONUT_FILTER,
} from "@/components/dashboard/charts/ApplicationDonut"
import {
  ApplicationFunctionality,
  APP_FUNCTIONALITY_FILTER,
} from "@/components/dashboard/charts/ApplicationFunctionality"
import { CadBars, CAD_BARS_FILTER } from "@/components/dashboard/charts/CadBars"
import {
  RegionBars,
  REGION_BARS_FILTER,
} from "@/components/dashboard/charts/RegionBars"
import {
  RegionMonthly,
  REGION_MONTHLY_FILTER,
} from "@/components/dashboard/charts/RegionMonthly"
import {
  DomainList,
  DOMAIN_LIST_FILTER,
} from "@/components/dashboard/charts/DomainList"
import {
  FluidsSealingsSplit,
  FLUIDS_SEALING_FILTER,
} from "@/components/dashboard/charts/FluidsSealingsSplit"
import { YearlyUsageChart } from "@/components/YearlyUsageChart"
import { useChartFilters } from "@/lib/filter-context"
import { useDashboardSearch } from "@/lib/search-context"
import { filterRawSessions } from "@/lib/filtering"
import { num } from "@/lib/format"
import type { FilterDim, YearlyMonthlyUsagePoint } from "@/lib/types"

const HOME_KPI_FILTER: { id: string; applicable: readonly FilterDim[] } = {
  id: "homeKpis",
  applicable: [
    "range",
    "application",
    "cad",
    "productLine",
    "region",
    "domain",
    "hardware",
    "status",
  ],
}

const YEARLY_YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"] as const;

const YEARLY_USAGE_FILTER: { id: string; applicable: readonly FilterDim[] } = {
  id: "yearlyUsage",
  applicable: [
    "application",
    "cad",
    "productLine",
    "region",
    "domain",
    "hardware",
    "status",
  ],
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

const REGION_LABELS: Record<string, string> = {
  NA: "North America",
  EU: "Europe",
  ASIA: "Asia",
  SA: "South America",
}

const CHART_SEARCH_COPY = {
  cad: "cad platform catia nx host runs tool usage",
  fluids: "fluids sealings sealing product line split runs",
  monthlyTotal: "month monthly usage runs calendar trend cad bar line totals",
  yearlyUsage: "year yearly annual usage compare across years month trend",
  yearHeatmap: "month busiest heatmap year usage quiet busy",
  monthlyHeatmap: "day daily month heatmap calendar usage time",
  appCompare: "application app kbe tool compare monthly side by side line bar",
  appDonut: "application app kbe tool most top runs donut",
  appFunctionality:
    "functionality function activity application app tool ranked",
  regionBars: "region regional geography world location na eu asia runs",
  domainList: "domain engineering technical corporate group user users runs",
  regionMonthly:
    "region regional monthly trend geography year stacked side by side",
} as const

function searchMatches(query: string, ...parts: string[]): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const haystack = parts.join(" ").toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

/** "FLUIDS" → "Fluids", but leaves short tokens (FBD, FTS) uppercase. */
function prettyProductLine(value: string): string {
  if (value.length <= 3) return value
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export default function HomePage() {
  const { query: dashboardSearch, clearQuery } = useDashboardSearch()
  const { effective: kpiFilters } = useChartFilters(
    HOME_KPI_FILTER.id,
    HOME_KPI_FILTER.applicable
  )

  const searchQuery = dashboardSearch.trim()
  const isSearching = searchQuery.length > 0

  const kpis = useMemo(() => {
    const sessions = filterRawSessions(kpiFilters)

    // Busiest month within the active window — bucket every filtered run by
    // its month index so the KPI tracks whatever range the user picks (this
    // year, last year, custom, …) instead of hard-coding the calendar year.
    const monthBuckets: number[] = new Array(12).fill(0)
    for (const s of sessions) {
      const m = s.monthIndex
      if (m >= 0 && m < 12) monthBuckets[m]! += 1
    }
    let busiestIdx = -1
    let busiestCount = 0
    for (let i = 0; i < 12; i++) {
      if (monthBuckets[i]! > busiestCount) {
        busiestCount = monthBuckets[i]!
        busiestIdx = i
      }
    }

    // Top application (+ runner-up) from filtered sessions.
    const appCounts = new Map<string, number>()
    for (const s of sessions) {
      appCounts.set(s.application, (appCounts.get(s.application) ?? 0) + 1)
    }
    const sortedApps = [...appCounts.entries()].sort((a, b) => b[1] - a[1])

    // Top product line.
    const plCounts = new Map<string, number>()
    for (const s of sessions) {
      plCounts.set(s.productLine, (plCounts.get(s.productLine) ?? 0) + 1)
    }
    const sortedPL = [...plCounts.entries()].sort((a, b) => b[1] - a[1])
    const totalPL = sortedPL.reduce((sum, [, n]) => sum + n, 0) || 1

    // Top region.
    const regCounts = new Map<string, number>()
    for (const s of sessions) {
      regCounts.set(s.region, (regCounts.get(s.region) ?? 0) + 1)
    }
    const sortedReg = [...regCounts.entries()].sort((a, b) => b[1] - a[1])
    const totalReg = sortedReg.reduce((sum, [, n]) => sum + n, 0) || 1

    // Top domain (corporate group) by session count.
    const domCounts = new Map<string, number>()
    for (const s of sessions) {
      domCounts.set(s.domain, (domCounts.get(s.domain) ?? 0) + 1)
    }
    const sortedDom = [...domCounts.entries()].sort((a, b) => b[1] - a[1])
    const totalDom = sortedDom.reduce((sum, [, n]) => sum + n, 0) || 1

    return {
      busiestMonth: busiestIdx >= 0 ? MONTH_NAMES[busiestIdx]! : "—",
      busiestCount,
      topApp: sortedApps[0]?.[0] ?? "—",
      topAppCount: sortedApps[0]?.[1] ?? 0,
      secondApp: sortedApps[1]?.[0],
      topProductLine: sortedPL[0] ? prettyProductLine(sortedPL[0][0]) : "—",
      topProductLineShare: sortedPL[0]
        ? Math.round((sortedPL[0][1] / totalPL) * 100)
        : 0,
      topRegion: sortedReg[0]?.[0] ?? "—",
      topRegionShare: sortedReg[0]
        ? Math.round((sortedReg[0][1] / totalReg) * 100)
        : 0,
      topDomain: sortedDom[0]?.[0] ?? "—",
      topDomainShare: sortedDom[0]
        ? Math.round((sortedDom[0][1] / totalDom) * 100)
        : 0,
    }
  }, [kpiFilters])

  const { effective: yearlyFilters } = useChartFilters(
    YEARLY_USAGE_FILTER.id,
    YEARLY_USAGE_FILTER.applicable
  )

  const [yearlySelectedYears, setYearlySelectedYears] = useState<string[]>(
    () => [...YEARLY_YEARS].slice(-5),
  )
  const toggleYearlyYear = (year: string) =>
    setYearlySelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year],
    )

  const yearlyChartData = useMemo(() => {
    const sessions = filterRawSessions({ ...yearlyFilters, range: "all" })
    const monthly: Record<string, Record<string, number>> = {} // e.g. { "2023": { "Jan": 10, "Feb": 12 }, ... }

    for (const s of sessions) {
      const year = String(s.year)
      const monthIndex = s.monthIndex
      if (monthIndex < 0 || monthIndex > 11) continue
      const month = MONTH_NAMES[monthIndex]!.slice(0, 3)

      if (!monthly[year]) monthly[year] = {}
      if (!monthly[year][month]) monthly[year][month] = 0
      monthly[year][month]++
    }

    const availableYears = [
      "2020",
      "2021",
      "2022",
      "2023",
      "2024",
      "2025",
      "2026",
    ]
    const data: YearlyMonthlyUsagePoint[] = MONTH_NAMES.map((m) =>
      m.slice(0, 3)
    ).map((month) => {
      const point: YearlyMonthlyUsagePoint = { month }
      for (const year of availableYears) {
        point[year] = monthly[year]?.[month] ?? 0
      }
      return point
    })

    return { data, availableYears }
  }, [yearlyFilters])

  const yearlyExportRows = useMemo(() => {
    const visibleYears =
      yearlySelectedYears.length > 0
        ? yearlySelectedYears
        : yearlyChartData.availableYears

    return yearlyChartData.data.map((point) => {
      const row: Record<string, string | number> = { month: point.month }
      for (const year of visibleYears) {
        row[year] = Number(point[year] ?? 0)
      }
      return row
    })
  }, [yearlyChartData, yearlySelectedYears])

  const chartMatches = {
    cad: searchMatches(
      searchQuery,
      "Which CAD platform hosts the most KBE tool runs?",
      "Tool runs grouped by CAD platform",
      CHART_SEARCH_COPY.cad
    ),
    fluids: searchMatches(
      searchQuery,
      "Fluids vs Sealings tool runs",
      "How KBE tool runs split across the two main product lines.",
      CHART_SEARCH_COPY.fluids
    ),
    monthlyTotal: searchMatches(
      searchQuery,
      "How many KBE tool runs per month?",
      "Monthly KBE tool runs, split by CAD platform.",
      CHART_SEARCH_COPY.monthlyTotal
    ),
    yearlyUsage: searchMatches(
      searchQuery,
      "How does KBE tool usage compare across years?",
      "Monthly KBE tool runs, stacked by year.",
      CHART_SEARCH_COPY.yearlyUsage
    ),
    yearHeatmap: searchMatches(
      searchQuery,
      "Which months are busiest for KBE tools?",
      "A single colored tile per month, scaled by total tool runs.",
      CHART_SEARCH_COPY.yearHeatmap
    ),
    monthlyHeatmap: searchMatches(
      searchQuery,
      "When during the year are KBE tools run?",
      "A day-by-month heatmap of tool runs.",
      CHART_SEARCH_COPY.monthlyHeatmap
    ),
    appCompare: searchMatches(
      searchQuery,
      "How do two KBE tools compare month by month?",
      "Pick any two KBE tools and switch between line or grouped bar.",
      CHART_SEARCH_COPY.appCompare
    ),
    appDonut: searchMatches(
      searchQuery,
      "Which KBE tools are run most?",
      "The top KBE tools by total runs.",
      CHART_SEARCH_COPY.appDonut
    ),
    appFunctionality: searchMatches(
      searchQuery,
      "Which functionality is used most in each KBE tool?",
      "Pick a KBE tool to see its top functionalities.",
      CHART_SEARCH_COPY.appFunctionality
    ),
    regionBars: searchMatches(
      searchQuery,
      "Where in the world are KBE tools run?",
      "Tool runs by region for the selected period.",
      CHART_SEARCH_COPY.regionBars
    ),
    domainList: searchMatches(
      searchQuery,
      "Which engineering domain runs the most KBE tools?",
      "Tool runs grouped by engineering domain.",
      CHART_SEARCH_COPY.domainList
    ),
    regionMonthly: searchMatches(
      searchQuery,
      "How does regional KBE usage trend across the year?",
      "Monthly run counts split by region.",
      CHART_SEARCH_COPY.regionMonthly
    ),
  }
  const chartMatchCount = Object.values(chartMatches).filter(Boolean).length

  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome back, Alex"
        description="A friendly overview of how Cooper Standard's KBE tools are being run inside CATIA and NX. Each chart carries its own filter chips — tweak any card without touching the others."
      />

      {!isSearching ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Headline KBE metrics
              </h2>
              <p className="text-xs text-muted-foreground">
                The five numbers everyone asks for first — adjust the chips
                below to scope the whole strip.
              </p>
            </div>
          </div>
          <ChartFilterChips
            chartId={HOME_KPI_FILTER.id}
            applicable={HOME_KPI_FILTER.applicable}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Peak month for KBE runs"
              value={kpis.busiestMonth}
              icon={CalendarDays}
              caption={
                kpis.busiestCount > 0
                  ? `${num(kpis.busiestCount)} runs`
                  : "No runs yet"
              }
              accent="blue"
            />
            <KpiCard
              label="Most-run KBE tool"
              value={kpis.topApp}
              icon={Sparkles}
              caption={
                kpis.secondApp
                  ? `2nd: ${kpis.secondApp}`
                  : `${num(kpis.topAppCount)} runs`
              }
              accent="gold"
            />

            <KpiCard
              label="Top product line"
              value={kpis.topProductLine}
              icon={Layers}
              caption={
                kpis.topProductLineShare > 0
                  ? `${kpis.topProductLineShare}% of runs`
                  : undefined
              }
              accent="gold"
            />
            <KpiCard
              label="Top region by runs"
              value={REGION_LABELS[kpis.topRegion] ?? kpis.topRegion}
              icon={Globe2}
              caption={
                kpis.topRegionShare > 0
                  ? `${kpis.topRegionShare}% of runs`
                  : undefined
              }
              accent="blue"
            />
            <KpiCard
              label="Top engineering domain"
              value={kpis.topDomain}
              icon={Building2}
              caption={
                kpis.topDomainShare > 0
                  ? `${kpis.topDomainShare}% of runs`
                  : undefined
              }
              accent="blue"
            />
          </div>
        </section>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Search results for "{searchQuery}"
            </h2>
            <p className="text-sm text-muted-foreground">
              Showing {chartMatchCount} matching{" "}
              {chartMatchCount === 1 ? "graph" : "graphs"}.
            </p>
          </div>
          <Button variant="outline" className="rounded-xl" onClick={clearQuery}>
            Clear search
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {isSearching && chartMatchCount === 0 ? (
          <div className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-border bg-card/60 p-6 text-center">
            <div className="max-w-md space-y-2">
              <h3 className="text-base font-semibold tracking-tight">
                No matching graphs found
              </h3>
              <p className="text-sm text-muted-foreground">
                Try words like domain, region, CAD, application, functionality,
                monthly, or yearly.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {chartMatches.cad ? (
            <ChartCard
              title="Which CAD platform hosts the most KBE tool runs?"
              description="Tool runs grouped by CAD platform, sorted from most-used to least-used."
              filter={CAD_BARS_FILTER}
              filterStyle="chips"
              className={
                isSearching && !chartMatches.fluids
                  ? "lg:col-span-2"
                  : undefined
              }
            >
              <CadBars />
            </ChartCard>
          ) : null}

          {chartMatches.fluids ? (
            <ChartCard
              title="Fluids vs Sealings tool runs"
              description="How KBE tool runs split across the two main product lines."
              filter={FLUIDS_SEALING_FILTER}
              filterStyle="chips"
              className={
                isSearching && !chartMatches.cad ? "lg:col-span-2" : undefined
              }
            >
              <FluidsSealingsSplit />
            </ChartCard>
          ) : null}
        </div>

        {chartMatches.monthlyTotal ? (
          <ChartCard
            title="How many KBE tool runs per month?"
            description="Monthly KBE tool runs, split by CAD platform. Toggle between bar and line view to compare totals at a glance."
            filter={MONTHLY_TOTAL_FILTER}
            filterStyle="chips"
          >
            <MonthlyUsageTotal />
          </ChartCard>
        ) : null}

        {chartMatches.yearlyUsage ? (
          <ChartCard
            title="How does KBE tool usage compare across years?"
            description="Monthly KBE tool runs, stacked by year. See which years were busier at a glance."
            filter={YEARLY_USAGE_FILTER}
            filterStyle="chips"
            exportRows={yearlyExportRows}
            filterPrefixSlot={
              <MultiChipPopover
                icon={CalendarDays}
                label="Year"
                options={[...YEARLY_YEARS]}
                selected={yearlySelectedYears}
                onChange={setYearlySelectedYears}
                allLabel="All years"
              />
            }
          >
            <YearlyUsageChart
              data={yearlyChartData.data}
              availableYears={yearlyChartData.availableYears}
              selectedYears={yearlySelectedYears}
              onToggleYear={toggleYearlyYear}
            />
          </ChartCard>
        ) : null}

        {chartMatches.yearHeatmap ? (
          <ChartCard
            title="Which months are busiest for KBE tools?"
            description="A single colored tile per month, scaled by total tool runs. Spot the year's busy and quiet stretches at a glance."
            filter={YEAR_HEATMAP_FILTER}
            filterStyle="chips"
          >
            <YearHeatmap />
          </ChartCard>
        ) : null}

        {chartMatches.monthlyHeatmap ? (
          <ChartCard
            title="When during the year are KBE tools run?"
            description="A day-by-month heatmap of tool runs. Darker cells mark busier days; the row under each column sums the month."
            filter={MONTHLY_HEATMAP_FILTER}
            filterStyle="chips"
          >
            <MonthlyHeatmap />
          </ChartCard>
        ) : null}

        {chartMatches.appCompare ? (
          <ChartCard
            title="How do two KBE tools compare month by month?"
            description="Pick any two KBE tools and switch between line or grouped bar to compare monthly run counts."
            filter={APP_COMPARE_FILTER}
            filterStyle="chips"
          >
            <AppCompare />
          </ChartCard>
        ) : null}

        {chartMatches.appDonut ? (
          <ChartCard
            title="Which KBE tools are run most?"
            description="The top KBE tools by total runs in the selected window."
            filter={APP_DONUT_FILTER}
            filterStyle="chips"
          >
            <ApplicationDonut />
          </ChartCard>
        ) : null}

        {chartMatches.appFunctionality ? (
          <ChartCard
            title="Which functionality is used most in each KBE tool?"
            description="Pick a KBE tool to see its top functionalities, ranked by run count."
            filter={APP_FUNCTIONALITY_FILTER}
            filterStyle="chips"
          >
            <ApplicationFunctionality />
          </ChartCard>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {chartMatches.regionBars ? (
            <ChartCard
              title="Where in the world are KBE tools run?"
              description="Tool runs by region for the selected period."
              filter={REGION_BARS_FILTER}
              filterStyle="chips"
              className={
                isSearching && !chartMatches.domainList
                  ? "lg:col-span-2"
                  : undefined
              }
            >
              <RegionBars />
            </ChartCard>
          ) : null}
          {chartMatches.domainList ? (
            <ChartCard
              title="Which engineering domain runs the most KBE tools?"
              description="Tool runs grouped by engineering domain, ranked from highest to lowest."
              filter={DOMAIN_LIST_FILTER}
              filterStyle="chips"
              className={
                isSearching && !chartMatches.regionBars
                  ? "lg:col-span-2"
                  : undefined
              }
            >
              <DomainList />
            </ChartCard>
          ) : null}
        </div>

        {chartMatches.regionMonthly ? (
          <ChartCard
            title="How does regional KBE usage trend across the year?"
            description="Monthly run counts split by region — switch between stacked totals, side-by-side bars, or trend lines."
            filter={REGION_MONTHLY_FILTER}
            filterStyle="chips"
          >
            <RegionMonthly />
          </ChartCard>
        ) : null}
      </div>

      <ApplicationDataExportCard />
    </div>
  )
}
