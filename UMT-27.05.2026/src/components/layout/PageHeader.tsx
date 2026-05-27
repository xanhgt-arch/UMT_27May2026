import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-2">
        {/* Blue bar + gold dot — a quiet echo of the CS swoosh that marks
            every page consistently. */}
        <span aria-hidden className="brand-accent" />
        <h1 className="text-2xl font-semibold tracking-tight text-[#0E4DA1] dark:text-primary md:text-[26px]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
