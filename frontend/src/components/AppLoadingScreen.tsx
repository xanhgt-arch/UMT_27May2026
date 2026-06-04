import { Activity, Database, Gauge, ShieldCheck } from "lucide-react"
import { useRef } from "react"

import { BrandMark } from "@/components/layout/BrandMark"
import { cn } from "@/lib/utils"

type AppLoadingScreenProps = {
  className?: string
  compact?: boolean
  label?: string
}

const statusItems = [
  { icon: Database, label: "Data", value: "syncing" },
  { icon: Activity, label: "Charts", value: "warming" },
  { icon: ShieldCheck, label: "Access", value: "secure" },
]

export function AppLoadingScreen({
  className,
  compact = false,
  label = "Preparing Usage Monitor",
}: AppLoadingScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const element = containerRef.current
    if (!element) return

    const bounds = element.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100

    element.style.setProperty("--loader-x", `${x.toFixed(2)}%`)
    element.style.setProperty("--loader-y", `${y.toFixed(2)}%`)
  }

  function handlePointerLeave() {
    const element = containerRef.current
    if (!element) return

    element.style.setProperty("--loader-x", "50%")
    element.style.setProperty("--loader-y", "44%")
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "umt-loader-bg isolate grid overflow-hidden bg-background text-foreground",
        compact ? "min-h-[420px] rounded-xl" : "fixed inset-0 z-[80] min-h-screen",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div
        aria-hidden
        className="brand-page-bg pointer-events-none absolute inset-0 opacity-80"
      />
      <div
        aria-hidden
        className="brand-hairline pointer-events-none absolute inset-x-0 top-0 h-[3px]"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-[620px] place-items-center px-5 py-10 text-center sm:px-8">
        <div className="group relative grid w-full place-items-center rounded-xl border border-border/80 bg-card/86 px-5 py-8 shadow-[0_24px_70px_-46px_oklch(0.43_0.17_256_/_0.55)] backdrop-blur-md transition-transform duration-300 hover:-translate-y-0.5 sm:px-8">
          <span
            aria-hidden
            className="brand-spark pointer-events-none absolute inset-x-10 top-0 h-[2px] opacity-90"
          />

          <div className="relative grid size-28 place-items-center">
            <span
              aria-hidden
              className="umt-loader-orbit absolute inset-0 rounded-full border border-primary/15"
            />
            <span
              aria-hidden
              className="umt-loader-orbit umt-loader-orbit-delay absolute inset-3 rounded-full border border-[oklch(0.83_0.16_88_/_0.22)]"
            />
            <span
              aria-hidden
              className="absolute inset-5 rounded-full bg-primary/8 ring-1 ring-primary/15 transition-transform duration-300 group-hover:scale-105"
            />
            <BrandMark className="relative size-16 drop-shadow-sm" />
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Gauge className="size-4 text-primary" aria-hidden />
            <span>{label}</span>
          </div>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Cooper Standard UMT
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Loading dashboard modules and usage intelligence.
          </p>

          <div className="mt-7 w-full max-w-md">
            <div className="relative h-2 overflow-hidden rounded-full bg-muted ring-1 ring-border/80">
              <span
                aria-hidden
                className="umt-loader-progress absolute inset-y-0 left-0 w-2/3 rounded-full bg-primary"
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(90deg,transparent,oklch(1_0_0_/_0.45),transparent)] opacity-50"
              />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-left">
              {statusItems.map((item) => {
                const Icon = item.icon

                return (
                  <div
                    key={item.label}
                    className="rounded-lg border border-border/80 bg-background/70 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="truncate text-[11px] font-medium text-muted-foreground">
                        {item.label}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold text-foreground">
                      {item.value}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <span className="sr-only">Loading application</span>
        </div>
      </div>
    </div>
  )
}
