import { Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterChips } from "@/components/dashboard/FilterChips";
import { ChartFilterPopover } from "@/components/dashboard/ChartFilterPopover";
import { SessionsTable, SESSIONS_FILTER } from "@/components/dashboard/SessionsTable";

export default function SessionsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Tool runs"
        description="A detailed log of every KBE tool run in CATIA or NX. Filter at the page level, or click ‘Filter’ above the table to override just here."
        action={
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => toast.info("CSV export — coming soon.")}
          >
            <Download className="size-4" />
            Export to CSV
          </Button>
        }
      />

      <FilterChips />

      <Card className="card-hover">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E4DA1] transition-colors group-hover/card:text-[color:oklch(0.55_0.13_82)] dark:text-primary dark:group-hover/card:text-[color:oklch(0.83_0.16_88)]">
                <span aria-hidden className="inline-flex items-center gap-0.5">
                  <span className="size-1.5 rounded-full bg-[oklch(0.43_0.17_256)]" />
                  <span className="size-1.5 rounded-full bg-[oklch(0.83_0.16_88)]" />
                </span>
                Tool run log
              </h3>
              <p className="text-xs text-muted-foreground">
                Showing rows that match the page filters above and any local override.
              </p>
            </div>
            <ChartFilterPopover
              chartId={SESSIONS_FILTER.id}
              applicable={SESSIONS_FILTER.applicable}
            />
          </div>
          <SessionsTable />
        </CardContent>
      </Card>
    </div>
  );
}
