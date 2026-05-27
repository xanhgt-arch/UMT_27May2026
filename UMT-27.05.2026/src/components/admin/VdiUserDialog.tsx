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
import { useAdminData, newVdiId } from "@/lib/admin-data";
import { REGIONS, TECH_DOMAINS } from "@/lib/mock-data";
import type { Region, VdiUserRecord } from "@/lib/types";

const STATUSES: VdiUserRecord["status"][] = ["Active", "Inactive", "Pending", "Disabled"];

export function VdiUserDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: VdiUserRecord | null;
}) {
  const { vdiUsers, upsertVdiUser } = useAdminData();
  const [form, setForm] = useState<VdiUserRecord>(blank(vdiUsers));
  const [errors, setErrors] = useState<Partial<Record<keyof VdiUserRecord, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : blank(vdiUsers));
      setErrors({});
    }
  }, [open, initial, vdiUsers]);

  const isEdit = initial != null;

  function set<K extends keyof VdiUserRecord>(key: K, value: VdiUserRecord[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.fullName.trim()) next.fullName = "Full name is required.";
    if (!form.email.trim() || !/.+@.+\..+/.test(form.email)) next.email = "Enter a valid email.";
    if (!form.hostname.trim()) next.hostname = "Machine ID is required.";
    if (!form.domain) next.domain = "Domain is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    upsertVdiUser({ ...form, lastSeen: form.lastSeen || new Date().toISOString() });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit VDI user" : "Add VDI user"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this user's directory and status information."
              : "Create a new VDI user record. They'll appear in the list immediately."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field id="fullName" label="Full name" error={errors.fullName} className="sm:col-span-2">
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="Alex Patel"
              className="h-10 rounded-xl"
            />
          </Field>

          <Field id="email" label="Email" error={errors.email} className="sm:col-span-2">
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="alex.patel@engineering.acme.com"
              className="h-10 rounded-xl"
            />
          </Field>

          <Field id="domain" label="Domain" error={errors.domain}>
            <Select value={form.domain} onValueChange={(v) => set("domain", v)}>
              <SelectTrigger id="domain" className="h-10 w-full rounded-xl">
                <SelectValue placeholder="Choose a domain" />
              </SelectTrigger>
              <SelectContent>
                {TECH_DOMAINS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <Field id="hostname" label="Machine ID" error={errors.hostname}>
            <Input
              id="hostname"
              value={form.hostname}
              onChange={(e) => set("hostname", e.target.value)}
              placeholder="VDI-1234"
              className="h-10 rounded-xl"
            />
          </Field>

          <Field id="status" label="Status">
            <Select value={form.status} onValueChange={(v) => set("status", v as VdiUserRecord["status"])}>
              <SelectTrigger id="status" className="h-10 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="rounded-xl">
            {isEdit ? "Save changes" : "Add user"}
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

function blank(existing: VdiUserRecord[]): VdiUserRecord {
  return {
    id: newVdiId(existing),
    fullName: "",
    email: "",
    domain: TECH_DOMAINS[0]!,
    region: REGIONS[0]!,
    hostname: "",
    status: "Active",
    lastSeen: new Date().toISOString(),
  };
}
