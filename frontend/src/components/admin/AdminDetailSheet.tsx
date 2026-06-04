import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export type DetailRow = { label: string; value: React.ReactNode };

export function AdminDetailSheet({
  open,
  onOpenChange,
  title,
  description,
  rows,
  primaryAction,
  destructiveAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  rows: DetailRow[];
  primaryAction?: { label: string; onClick: () => void };
  destructiveAction?: { label: string; onClick: () => void };
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>

        <dl className="grid gap-4 px-1 py-2">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-col gap-1">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {r.label}
              </dt>
              <dd className="text-sm">{r.value}</dd>
            </div>
          ))}
        </dl>

        <Separator />

        <div className="mt-auto flex items-center justify-between gap-2 px-1">
          {destructiveAction ? (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={destructiveAction.onClick}
            >
              {destructiveAction.label}
            </Button>
          ) : (
            <span />
          )}
          {primaryAction ? (
            <Button onClick={primaryAction.onClick} className="rounded-xl">
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
