import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { QUICK_LINKS } from "@/lib/mock-data";

export function QuickLinks() {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {QUICK_LINKS.map((q, i) => {
        const goldHover = i % 2 === 1;
        return (
          <li key={q.title}>
            <Link
              to={q.to}
              className={[
                "group relative flex items-start justify-between gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors",
                goldHover
                  ? "hover:border-[oklch(0.83_0.16_88_/_0.55)] hover:bg-[oklch(0.83_0.16_88_/_0.06)]"
                  : "hover:border-primary/40 hover:bg-accent/50",
              ].join(" ")}
            >
              {/* Brand rail on hover — alternates blue / gold across the
                  list so the row reads like the two-tone CS swoosh. */}
              <span
                aria-hidden
                className={[
                  "pointer-events-none absolute inset-y-3 left-0 w-[3px] origin-left scale-y-0 rounded-full transition-transform duration-200 group-hover:scale-y-100",
                  goldHover ? "bg-[oklch(0.83_0.16_88)]" : "bg-[oklch(0.43_0.17_256)]",
                ].join(" ")}
              />
              <div>
                <div
                  className={[
                    "text-sm font-medium transition-colors",
                    goldHover
                      ? "group-hover:text-[color:oklch(0.55_0.13_82)] dark:group-hover:text-[color:oklch(0.83_0.16_88)]"
                      : "group-hover:text-[#0E4DA1] dark:group-hover:text-primary",
                  ].join(" ")}
                >
                  {q.title}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{q.description}</div>
              </div>
              <ArrowRight
                className={[
                  "size-4 shrink-0 translate-x-0 transition-transform group-hover:translate-x-0.5",
                  goldHover
                    ? "text-muted-foreground group-hover:text-[oklch(0.55_0.13_82)]"
                    : "text-muted-foreground group-hover:text-primary",
                ].join(" ")}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
