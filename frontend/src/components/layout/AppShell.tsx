import { Outlet } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { ParticleBackground } from "./ParticleBackground"
import { FilterProvider } from "@/lib/filter-context"
import { AdminDataProvider } from "@/lib/admin-data"
import { DashboardSearchProvider } from "@/lib/search-context"
import { AuthProvider } from "@/lib/auth-context"

export function AppShell() {
  return (
    <FilterProvider>
      <AuthProvider>
        <AdminDataProvider>
          <DashboardSearchProvider>
            <TooltipProvider delayDuration={250}>
              <ParticleBackground />
              {/* Brand hairline - the only place blue + gold meet, echoing
                the swoosh in the Cooper Standard mark. */}
              <div
                aria-hidden
                className="brand-hairline fixed inset-x-0 top-0 z-50 h-[3px]"
              />

              <div className="relative z-10 flex min-h-screen text-foreground">
                <Sidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Topbar />
                  <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 md:px-8 md:py-10">
                    <Outlet />
                  </main>
                  <footer className="relative border-t border-border px-4 py-4 text-center text-xs text-muted-foreground md:px-8">
                    {/* Faint gold spark above the footer - closes the page with
                      the same brand pulse that opens it at the very top. */}
                    <div
                      aria-hidden
                      className="brand-spark pointer-events-none absolute inset-x-0 -top-px h-[2px] opacity-60"
                    />
                    <span className="font-semibold tracking-tight">
                      <span className="text-[#0E4DA1] dark:text-primary">
                        Cooper
                      </span>
                      <span className="text-[color:oklch(0.62_0.13_82)] dark:text-[color:oklch(0.83_0.16_88)]">
                        Standard
                      </span>
                    </span>
                    <span className="mx-2 text-border">·</span>
                    UMT - Usage Monitoring Tool
                    <span className="mx-2 text-border">·</span>
                    Internal use only
                  </footer>
                </div>
              </div>
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </DashboardSearchProvider>
        </AdminDataProvider>
      </AuthProvider>
    </FilterProvider>
  )
}
