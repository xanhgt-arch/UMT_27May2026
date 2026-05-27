import { useMemo, useState } from "react"
import {
  CheckCircle2,
  CircleSlash,
  Clock,
  PauseCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { VdiUserDialog } from "@/components/admin/VdiUserDialog"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { useAdminData } from "@/lib/admin-data"
import { initials, relative } from "@/lib/format"
import type { VdiUserRecord } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_TONE: Record<VdiUserRecord["status"], string> = {
  Active: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  Inactive: "bg-zinc-500/12 text-zinc-700 dark:text-zinc-300",
  Pending: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  Disabled: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tone: string
}) {
  return (
    <Card className="brand-edge-top card-hover">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("grid size-10 place-items-center rounded-xl", tone)}>
          <Icon className="size-[18px]" />
        </div>
        <div>
          <div className="num text-2xl leading-none font-semibold">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function VdiUsersPage() {
  const { vdiUsers, removeVdiUser } = useAdminData()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState<VdiUserRecord | null>(null)
  const [editing, setEditing] = useState<VdiUserRecord | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<VdiUserRecord | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return vdiUsers
    return vdiUsers.filter((u) =>
      [u.fullName, u.email, u.hostname, u.domain, u.region]
        .join(" ")
        .toLowerCase()
        .includes(q)
    )
  }, [query, vdiUsers])

  const stats = useMemo(
    () => ({
      total: vdiUsers.length,
      active: vdiUsers.filter((u) => u.status === "Active").length,
      inactive: vdiUsers.filter((u) => u.status === "Inactive").length,
      pending: vdiUsers.filter((u) => u.status === "Pending").length,
      disabled: vdiUsers.filter((u) => u.status === "Disabled").length,
    }),
    [vdiUsers]
  )

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(record: VdiUserRecord) {
    setActive(null)
    setEditing(record)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="VDI users"
        description="Add, view, and manage your virtual desktop users. Click any row to see full details."
        action={
          <Button className="gap-2 rounded-xl" onClick={openCreate}>
            <Plus className="size-4" />
            Add VDI user
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active"
          value={stats.active}
          icon={CheckCircle2}
          tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        />
        <StatCard
          label="Inactive"
          value={stats.inactive}
          icon={PauseCircle}
          tone="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300"
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={Clock}
          tone="bg-amber-500/10 text-amber-700 dark:text-amber-300"
        />
        <StatCard
          label="Disabled"
          value={stats.disabled}
          icon={CircleSlash}
          tone="bg-rose-500/10 text-rose-700 dark:text-rose-300"
        />
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users by name, email, machine ID…"
                className="h-10 rounded-xl pr-10 pl-9"
                aria-label="Search VDI users"
              />
              {query ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuery("")}
                  className="absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-lg text-muted-foreground hover:text-foreground"
                  aria-label="Clear VDI user search"
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">
              {filtered.length} of {vdiUsers.length} users
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Domain</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Machine ID
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Region</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setActive(u)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                            {initials(u.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="leading-tight">
                          <div className="font-medium">{u.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u.domain}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {u.hostname}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {u.region}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {relative(u.lastSeen)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg"
                          aria-label={`Edit ${u.fullName}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(u)
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${u.fullName}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleting(u)
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
                      colSpan={5}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No users match your search.
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
        title={active?.fullName ?? ""}
        description={active?.email}
        rows={[
          {
            label: "Status",
            value: active ? (
              <Badge
                variant="secondary"
                className={cn(
                  "rounded-full border-transparent px-2.5 py-0.5 font-medium",
                  STATUS_TONE[active.status]
                )}
              >
                {active.status}
              </Badge>
            ) : null,
          },
          { label: "Domain", value: active?.domain },
          { label: "Region", value: active?.region },
          { label: "Machine ID", value: active?.hostname },
          {
            label: "Last seen",
            value: active ? relative(active.lastSeen) : null,
          },
        ]}
        primaryAction={
          active
            ? { label: "Edit user", onClick: () => openEdit(active) }
            : undefined
        }
        destructiveAction={
          active
            ? {
                label: "Delete user",
                onClick: () => {
                  setDeleting(active)
                  setActive(null)
                },
              }
            : undefined
        }
      />

      <VdiUserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
      />

      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.fullName}?` : "Delete user?"}
        description="This permanently removes the VDI user record. Their tool run history will remain in reports."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleting) {
            removeVdiUser(deleting.id)
            toast.success(`${deleting.fullName} deleted.`)
          }
        }}
      />

      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex items-center gap-3 p-5">
          <UserCheck className="size-5 text-primary" />
          <div className="text-sm text-muted-foreground">
            Tip — set a user to <span className="font-medium">Disabled</span> to
            keep their tool run history. Use{" "}
            <span className="font-medium">Delete</span> only when removing a
            record entirely.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
