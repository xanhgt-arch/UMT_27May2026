import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
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

export function VdiUserDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: VdiUserRecord | null;
}) {
  const { vdiUsers } = useAdminData();

  const [form, setForm] = useState<VdiUserRecord>(blank(vdiUsers));
  const [errors, setErrors] = useState<any>({});
  const [customDomain, setCustomDomain] = useState("");

  const isEdit = !!initial;

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : blank(vdiUsers));
      setErrors({});
    }
  }, [open, initial, vdiUsers]);

  function set<K extends keyof VdiUserRecord>(key: K, value: VdiUserRecord[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    const next: any = {};

    if (!form.fullName.trim()) next.fullName = "User ID required";
    if (!form.domain) next.domain = "Domain required";
    if (!form.region) next.region = "Region required";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  
  async function handleSubmit() {
    if (!validate()) return;


    const payload = {
      userId: form.fullName,
      domain: form.domain,
      region: form.region,
    };

    const options: RequestInit = {
      method: isEdit ? "PUT" : "POST",
      credentials: "include", // ✅ required for Windows Auth
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    };

    if (isEdit) {
      await fetch(`/api/vdi/${form.fullName}`, options);
    } else {
      await fetch(`/api/vdi`, options);
    }

    window.location.reload();
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>

        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit VDI user" : "Add VDI user"}
          </DialogTitle>
        </DialogHeader>

        
        <div className="space-y-5">

          {/* USER ID */}
          <Field label="User ID" error={errors.fullName}>
            <Input
              value={form.fullName}
              
              disabled={isEdit}
              onChange={(e) => set("fullName", e.target.value)}

              className="h-11 rounded-lg"
            />
          </Field>

          {/* DOMAIN */}
          <Field label="Domain" error={errors.domain}>
            <div className="space-y-3">
              <Select
                value={form.domain}
                onValueChange={(v) => {
                  if (v === "__custom__") {
                    set("domain", "");
                  } else {
                    set("domain", v);
                    setCustomDomain("");
                  }
                }}
              >
                <SelectTrigger className="h-11 rounded-lg">
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>

                <SelectContent>
                  {TECH_DOMAINS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}

                  <SelectItem value="__custom__">
                    ➕ Add new domain
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* CUSTOM DOMAIN INPUT */}
              {form.domain === "" && (
                <Input
                  placeholder="Enter new domain"
                  value={customDomain}
                  onChange={(e) => {
                    setCustomDomain(e.target.value);
                    set("domain", e.target.value);
                  }}
                  className="h-11 rounded-lg"
                />
              )}
            </div>
          </Field>

          {/* REGION */}
          <Field label="Region" error={errors.region}>
            <Select
              value={form.region}
              onValueChange={(v) => set("region", v as Region)}
            >
              <SelectTrigger className="h-11 rounded-lg">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>

          <Button onClick={handleSubmit}>
            {isEdit ? "Save" : "Add"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}


function Field({ label, error, children }: any) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>

      {children}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}


function blank(existing: VdiUserRecord[]): VdiUserRecord {
  return {
    id: newVdiId(existing),
    fullName: "",
    email: "",
    domain: "",
    region: "NA",
    hostname: "",
    status: "Active",
    lastSeen: new Date().toISOString(),
  };
}