import { Moon, Search, ShieldCheck, Sun, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useTheme } from "@/components/theme-provider"
import { useDashboardSearch } from "@/lib/search-context"
import { useAuth } from "@/lib/auth-context"
import { BrandMark } from "./BrandMark"
import { PaletteSwitcher } from "./PaletteSwitcher"

export function Topbar() {
  const { theme, setTheme } = useTheme()
  const { query, setQuery, clearQuery } = useDashboardSearch()
  const { user } = useAuth()
  const [inputValue, setInputValue] = useState(query)
  const isDark = theme === "dark"
  const displayUser = user?.userId || "User"
  const displayRole = user?.isAdmin ? "Administrator" : "User"
  const initials = displayUser
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U"

  useEffect(() => {
    setInputValue(query)
  }, [query])

  useEffect(() => {
    if (inputValue === query) return
    const timer = window.setTimeout(() => {
      setQuery(inputValue)
    }, 220)

    return () => window.clearTimeout(timer)
  }, [inputValue, query, setQuery])

  function clearSearch() {
    setInputValue("")
    clearQuery()
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search home charts by domain, region, CAD..."
          className="h-10 rounded-xl pr-10 pl-9"
          aria-label="Search home charts"
        />
        {inputValue || query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clearSearch}
            className="absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Clear dashboard search"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div
          className="group/chip relative mr-2 hidden items-center gap-2 overflow-hidden rounded-full border border-[oklch(0.43_0.17_256_/_0.18)] bg-card py-1 pr-3 pl-1.5 shadow-[0_1px_0_0_oklch(0.83_0.16_88_/_0.35)_inset] transition-colors hover:border-[oklch(0.83_0.16_88_/_0.55)] lg:flex"
          aria-label="Cooper Standard tenant"
        >
          <span className="grid size-6 place-items-center rounded-full bg-primary/8 ring-1 ring-[oklch(0.83_0.16_88_/_0.45)] transition-shadow group-hover/chip:ring-[oklch(0.83_0.16_88)]">
            <BrandMark className="size-[18px]" />
          </span>
          <span className="text-[11px] font-semibold tracking-tight">
            <span className="text-[#0E4DA1] dark:text-primary">Cooper</span>
            <span className="ml-0.5 text-[color:oklch(0.62_0.13_82)] dark:text-[color:oklch(0.83_0.16_88)]">
              Standard
            </span>
          </span>
          <span className="h-3 w-px bg-border" aria-hidden />
          <span className="flex items-center gap-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            <ShieldCheck className="size-3 text-[color:oklch(0.62_0.13_148)]" />
            Internal
          </span>
        </div>

        <PaletteSwitcher />
        <Button
          variant="ghost"
          size="icon"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="rounded-xl"
        >
          {isDark ? (
            <Sun className="size-[18px]" />
          ) : (
            <Moon className="size-[18px]" />
          )}
        </Button>
        <div className="ml-2 flex items-center gap-3 border-l border-border pl-3">
          <div className="hidden text-right text-sm leading-tight md:block">
            <div className="font-medium">{displayUser}</div>
            <div className="text-xs text-muted-foreground">{displayRole}</div>
          </div>
          <Avatar className="size-9 ring-2 ring-primary/15">
            <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
