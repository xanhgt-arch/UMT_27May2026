import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAdminData, newDomId } from "@/lib/admin-data";
import { CORP_GROUPS, REGIONS } from "@/lib/mock-data";
import type { DomainRecord, Region } from "@/lib/types";

export function DomainDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: DomainRecord | null;
}) {
  const { domainRecords, upsertDomainRecord } = useAdminData();
  const [form, setForm] = useState<DomainRecord>(blank(domainRecords));
  const [errors, setErrors] = useState<Partial<Record<keyof DomainRecord, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : blank(domainRecords));
      setErrors({});
    }
  }, [open, initial, domainRecords]);

  const isEdit = initial != null;

  function set<K extends keyof DomainRecord>(key: K, value: DomainRecord[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.technicalDomain.trim()) next.technicalDomain = "Technical domain is required.";
    if (!form.corporateGroup.trim()) next.corporateGroup = "Corporate group is required.";
    if (form.users < 0 || !Number.isFinite(form.users)) next.users = "Users must be a non-negative number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    upsertDomainRecord(form);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit domain mapping" : "Add domain mapping"}</DialogTitle>
          <DialogDescription>
            Map one technical domain to a single corporate group. Reporting uses this mapping for accuracy.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field id="technicalDomain" label="Technical domain" error={errors.technicalDomain} className="sm:col-span-2">
            <Input
              id="technicalDomain"
              value={form.technicalDomain}
              onChange={(e) => set("technicalDomain", e.target.value)}
              placeholder="engineering.acme"
              className="h-10 rounded-xl"
            />
          </Field>

          <Field id="corporateGroup" label="Corporate group" error={errors.corporateGroup} className="sm:col-span-2">
            <Input
              id="corporateGroup"
              value={form.corporateGroup}
              onChange={(e) => set("corporateGroup", e.target.value)}
              placeholder="ACME Engineering"
              className="h-10 rounded-xl"
              list="corp-groups"
            />
            <datalist id="corp-groups">
              {CORP_GROUPS.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>

          <Field id="region" label="Region">
            <Select value={form.region} onValueChange={(v) => set("region", v as Region)}>
              <SelectTrigger id="region" className="h-10 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field id="users" label="Users" error={errors.users}>
            <Input
              id="users"
              type="number"
              min={0}
              value={form.users}
              onChange={(e) => set("users", Number(e.target.value))}
              className="h-10 rounded-xl"
            />
          </Field>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3 sm:col-span-2">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">
                Active mappings are included in reporting. Archived ones are kept for history.
              </div>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="rounded-xl">
            {isEdit ? "Save changes" : "Add mapping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={["space-y-1.5", className].filter(Boolean).join(" ")}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function blank(existing: DomainRecord[]): DomainRecord {
  return {
    id: newDomId(existing),
    technicalDomain: "",
    corporateGroup: "",
    region: REGIONS[0]!,
    users: 0,
    active: true,
  };
}
