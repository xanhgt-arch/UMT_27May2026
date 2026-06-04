import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useChartFilters } from "@/lib/filter-context"
import { filterRawSessions } from "@/lib/filtering"
import { initials, durationMin, dateTime } from "@/lib/format"
import type { FilterDim, SessionStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 10

const STATUS_TONE: Record<SessionStatus, string> = {
  Active: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  Completed: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  Failed: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  Stopped: "bg-zinc-500/12 text-zinc-700 dark:text-zinc-300",
}

export const SESSIONS_FILTER: { id: string; applicable: readonly FilterDim[] } =
  {
    id: "sessionsTable",
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

export function SessionsTable() {
  const { effective } = useChartFilters(
    SESSIONS_FILTER.id,
    SESSIONS_FILTER.applicable
  )
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const byFilter = filterRawSessions(effective)
    const q = query.trim().toLowerCase()
    if (!q) return byFilter
    return byFilter.filter((row) =>
      [
        row.application,
        row.cad,
        row.user,
        row.machine,
        row.domain,
        row.region,
        row.productLine,
        row.status,
        row.hardware,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    )
  }, [query, effective])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  return (
    <div>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Search by user, app, machine, region…"
            className="h-10 rounded-xl pr-10 pl-9"
            aria-label="Search tool runs"
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setQuery("")
                setPage(1)
              }}
              className="absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Clear tool run search"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">{visible.length}</span>{" "}
          of{" "}
          <span className="font-medium text-foreground">{filtered.length}</span>{" "}
          runs
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="min-w-[200px]">User</TableHead>
              <TableHead>Application</TableHead>
              <TableHead className="hidden md:table-cell">CAD</TableHead>
              <TableHead className="hidden lg:table-cell">Region</TableHead>
              <TableHead className="hidden xl:table-cell">Domain</TableHead>
              <TableHead className="hidden xl:table-cell">Hardware</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="hidden lg:table-cell">Stopped</TableHead>
              <TableHead className="hidden md:table-cell">Duration</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                        {initials(s.user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="leading-tight">
                      <div className="font-medium">{s.user}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.machine}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{s.application}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.productLine}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{s.cad}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {s.region}
                </TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">
                  {s.domain}
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <Badge
                    variant="secondary"
                    className="rounded-full border-transparent bg-muted px-2.5 py-0.5 text-xs font-medium"
                  >
                    {s.hardware}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {dateTime(s.startTime)}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                  {s.stopTime ? dateTime(s.stopTime) : "—"}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {durationMin(s.startTime, s.stopTime)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "rounded-full border-transparent px-2.5 py-0.5 font-medium",
                      STATUS_TONE[s.status]
                    )}
                  >
                    {s.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No sessions match your filters. Try widening the date range or
                  clearing a chip.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Page {safePage} of {pageCount}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg"
          >
            <ChevronLeft className="size-4" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="rounded-lg"
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
