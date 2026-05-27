import { useMemo, useState } from "react"
import { Network, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AdminDetailSheet } from "@/components/admin/AdminDetailSheet"
import { DomainDialog } from "@/components/admin/DomainDialog"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { useAdminData } from "@/lib/admin-data"
import { num } from "@/lib/format"
import type { DomainRecord } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function DomainsPage() {
  const { domainRecords, vdiUsers, removeDomainRecord } = useAdminData()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState<DomainRecord | null>(null)
  const [editing, setEditing] = useState<DomainRecord | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<DomainRecord | null>(null)

  const alignedDomainRecords = useMemo(() => {
    const usersByDomain = new Map<string, number>()
    for (const user of vdiUsers) {
      usersByDomain.set(user.domain, (usersByDomain.get(user.domain) ?? 0) + 1)
    }
    return domainRecords.map((domain) => ({
      ...domain,
      users: usersByDomain.get(domain.technicalDomain) ?? 0,
    }))
  }, [domainRecords, vdiUsers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return alignedDomainRecords
    return alignedDomainRecords.filter((d) =>
      [d.technicalDomain, d.corporateGroup, d.region]
        .join(" ")
        .toLowerCase()
        .includes(q)
    )
  }, [query, alignedDomainRecords])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(record: DomainRecord) {
    setActive(null)
    setEditing(record)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Domains"
        description="Group technical domains under a single corporate name. The mapping powers all reporting accuracy."
        action={
          <Button className="gap-2 rounded-xl" onClick={openCreate}>
            <Plus className="size-4" />
            Add domain mapping
          </Button>
        }
      />

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search domains…"
                className="h-10 rounded-xl pr-10 pl-9"
                aria-label="Search domains"
              />
              {query ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuery("")}
                  className="absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-lg text-muted-foreground hover:text-foreground"
                  aria-label="Clear domain search"
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">
              {filtered.length} of {alignedDomainRecords.length} mappings
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Domain</TableHead>
                  <TableHead className="hidden md:table-cell">Region</TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    Users
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setActive(d)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Network className="size-4 text-muted-foreground" />
                        <span className="font-medium">{d.technicalDomain}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {d.region}
                    </TableCell>
                    <TableCell className="num hidden text-right tabular-nums md:table-cell">
                      {num(d.users)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg"
                          aria-label={`Edit ${d.technicalDomain}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(d)
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${d.technicalDomain}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleting(d)
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No domain mappings match your search.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AdminDetailSheet
        open={active != null}
        onOpenChange={(open) => !open && setActive(null)}
        title={active?.corporateGroup ?? ""}
        description={active ? `Mapped from ${active.technicalDomain}` : ""}
        rows={[
          { label: "Domain", value: active?.technicalDomain },
          { label: "Region", value: active?.region },
          { label: "Users", value: active ? num(active.users) : null },
          {
            label: "State",
            value: active ? (
              <Badge
                variant="secondary"
                className={cn(
                  "rounded-full border-transparent px-2.5 py-0.5 font-medium",
                  active.active
                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                    : "bg-zinc-500/12 text-zinc-700 dark:text-zinc-300"
                )}
              >
                {active.active ? "Active" : "Archived"}
              </Badge>
            ) : null,
          },
        ]}
        primaryAction={
          active
            ? { label: "Edit mapping", onClick: () => openEdit(active) }
            : undefined
        }
        destructiveAction={
          active
            ? {
                label: "Delete mapping",
                onClick: () => {
                  setDeleting(active)
                  setActive(null)
                },
              }
            : undefined
        }
      />

      <DomainDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
      />

      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={
          deleting ? `Delete ${deleting.technicalDomain}?` : "Delete mapping?"
        }
        description="This removes the mapping permanently. Reporting will fall back to the raw technical domain name."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleting) {
            removeDomainRecord(deleting.id)
            toast.success(`${deleting.technicalDomain} deleted.`)
          }
        }}
      />
    </div>
  )
}
