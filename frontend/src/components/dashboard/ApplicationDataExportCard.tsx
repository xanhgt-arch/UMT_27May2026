import { Database, Download } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChartFilterChips } from "@/components/dashboard/ChartFilterChips"
import { useChartFilters } from "@/lib/filter-context"
import { useAuth } from "@/lib/auth-context"
import type { FilterDim } from "@/lib/types"

const APPLICATION_DATA_EXPORT_FILTER: {
  id: string
  applicable: readonly FilterDim[]
} = {
  id: "applicationDataExport",
  applicable: ["range", "cad", "hardware"],
}

const APPLICATION_EXPORTS = [
  { key: "3d-trim", appName: "3D Trim", tableName: "mst_3dtrim_data" },
  {
    key: "multiple-3d-operations",
    appName: "Multiple 3D Operations",
    tableName: "mst_multi3d_details",
  },
  { key: "naming-tool", appName: "Naming Tool", tableName: "mst_namingtool_data" },
  { key: "point-chart", appName: "Point Chart", tableName: "mst_pointchart_data" },
  {
    key: "profile-checker",
    appName: "Profile Checker",
    tableName: "mst_profilechecker_data",
  },
  { key: "smart-cvt", appName: "Smart CVT", tableName: "mst_smartcvt_data" },
  {
    key: "section-manager",
    appName: "Section Manager",
    tableName: "mst_sectionmanager_data",
  },
] as const

type ApplicationExportKey = (typeof APPLICATION_EXPORTS)[number]["key"]

export function ApplicationDataExportCard() {
  const { user, loading } = useAuth()
  const { effective } = useChartFilters(
    APPLICATION_DATA_EXPORT_FILTER.id,
    APPLICATION_DATA_EXPORT_FILTER.applicable,
  )

  if (loading || !user?.isAdmin) return null

  return (
    <ApplicationDataExportForm
      initialKey={APPLICATION_EXPORTS[0].key}
      filters={effective}
    />
  )
}

function ApplicationDataExportForm({
  initialKey,
  filters,
}: {
  initialKey: ApplicationExportKey
  filters: ReturnType<typeof useChartFilters>["effective"]
}) {
  const [selectedKey, setSelectedKey] =
    useState<ApplicationExportKey>(initialKey)
  const selected =
    APPLICATION_EXPORTS.find((item) => item.key === selectedKey) ??
    APPLICATION_EXPORTS[0]

  const handleDownload = async (applicationKey: ApplicationExportKey) => {
    const params = new URLSearchParams()
    params.set("range", filters.range)
    if (filters.customFrom) params.set("customFrom", filters.customFrom)
    if (filters.customTo) params.set("customTo", filters.customTo)
    filters.cad.forEach((cad) => params.append("cad", cad))
    filters.hardware.forEach((hardware) => params.append("hardware", hardware))

    const url = `/api/export/application-data/${applicationKey}?${params.toString()}`
    toast.info("Preparing application table CSV...")

    try {
      const response = await fetch(url, {
        credentials: "include",
        headers: { Accept: "text/csv" },
      })

      if (!response.ok) {
        throw new Error(`Export failed with HTTP ${response.status}`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const filename =
        selected.tableName.endsWith(".csv")
          ? selected.tableName
          : `${selected.tableName}.csv`

      const link = document.createElement("a")
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
      toast.success(`${selected.appName} CSV downloaded.`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to download application CSV.",
      )
    }
  }

  return (
    <Card className="card-brand-shadow overflow-hidden">
      <CardHeader className="gap-1.5 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#0E4DA1] dark:text-primary">
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                <Database className="size-4" />
              </span>
              Application table data
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Download full backend application tables as CSV using the selected date, CAD, and VDI filters.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={selectedKey}
              onValueChange={(value) => setSelectedKey(value as ApplicationExportKey)}
            >
              <SelectTrigger className="h-9 w-full min-w-[260px] rounded-lg sm:w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLICATION_EXPORTS.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    {item.appName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="pt-2">
          <ChartFilterChips
            chartId={APPLICATION_DATA_EXPORT_FILTER.id}
            applicable={APPLICATION_DATA_EXPORT_FILTER.applicable}
            labelOverrides={{
              hardware: { label: "Tool", allLabel: "VDI and Non-VDI" },
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/25 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <div className="font-medium text-foreground">{selected.appName}</div>
            <div className="truncate text-xs text-muted-foreground">
              Backend table: {selected.tableName}
            </div>
          </div>
          <Button
            type="button"
            className="h-9 gap-2 rounded-lg"
            onClick={() => handleDownload(selected.key)}
          >
            <Download className="size-4" />
            Download CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
