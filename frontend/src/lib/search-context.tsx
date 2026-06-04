import { createContext, useContext, useMemo, useState } from "react"

type DashboardSearchCtx = {
  query: string
  setQuery: (value: string) => void
  clearQuery: () => void
}

const Ctx = createContext<DashboardSearchCtx | null>(null)

export function DashboardSearchProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [query, setQuery] = useState("")

  const value = useMemo<DashboardSearchCtx>(
    () => ({
      query,
      setQuery,
      clearQuery: () => setQuery(""),
    }),
    [query]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDashboardSearch(): DashboardSearchCtx {
  const ctx = useContext(Ctx)
  if (!ctx)
    throw new Error(
      "useDashboardSearch must be used inside <DashboardSearchProvider>"
    )
  return ctx
}
